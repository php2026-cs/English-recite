import { useId, useRef, useState } from 'react';
import type { LexiconEntry } from '../data/lexicon/types';
import type { WordWithMeanings } from '../types';
import { db } from '../db/db';
import { wordRepository } from '../repositories/wordRepository';
import { meaningRepository } from '../repositories/meaningRepository';
import { candidateKey, filterMissingCandidates, groupCandidatesByPartOfSpeech } from '../services/dictionary/candidates';
import { lexiconEntryToCandidates } from '../services/lexicon/localLexicon';
import { Button } from './Button';

export function LexiconEntryPicker({ entry, existingWord }: { entry: LexiconEntry; existingWord?: WordWithMeanings }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const candidates = lexiconEntryToCandidates(entry);
  const existingKeys = new Set(existingWord?.meanings.map(m => candidateKey(m.partOfSpeech, m.chineseMeaning)));
  const available = candidates.filter(c => !existingKeys.has(candidateKey(c.partOfSpeech, c.chineseMeaning)));
  const selectedCandidates = available.filter(c => selected.includes(c.id));

  async function save() {
    if (savingRef.current || selectedCandidates.length === 0) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const count = await db.transaction('rw', db.words, db.meanings, db.syncMeta, async () => {
        const found = await wordRepository.findByNormalizedWord(entry.word);
        const target = found ?? await wordRepository.create({ word: entry.word, phonetic: entry.phonetic });
        const meanings = await meaningRepository.listByWord(target.id);
        const missing = filterMissingCandidates(meanings, selectedCandidates);
        for (const candidate of missing) {
          await meaningRepository.create(target.id, { ...candidate, selectedForStudy: true });
        }
        return missing.length;
      });
      setSelected([]);
      setNotice(count ? `已加入 ${count} 个释义，可以继续选择其他单词。` : '所选释义已在词库中。');
    } catch {
      setError('加入失败，请重试。你的选择已保留。');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button type="button" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}
      className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-brand-50">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="break-all text-base font-semibold text-slate-900">{entry.word}</span><span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">CET6</span></span>
        <span className="mt-1 block text-xs text-slate-500">{entry.phonetic ? `${entry.phonetic} · ` : ''}{entry.senses.length} 个义项</span>
      </span>
      <span className="shrink-0 text-right text-xs"><span className={existingWord ? 'text-emerald-700' : 'text-slate-400'}>{existingWord ? '已加入' : '未加入'}</span><span className="mt-1 block text-slate-700">{open ? '收起释义 −' : '选择释义 ＋'}</span></span>
    </button>
    <div id={panelId} hidden={!open} className="border-t border-slate-200 p-4">
      {groupCandidatesByPartOfSpeech(candidates).map(group => <fieldset key={group.partOfSpeech} className="mb-4">
        <legend className="mb-2 text-xs font-bold text-slate-600">{group.partOfSpeech}</legend>
        <div className="space-y-2">{group.candidates.map(candidate => {
          const added = existingKeys.has(candidateKey(candidate.partOfSpeech, candidate.chineseMeaning));
          const checked = added || selected.includes(candidate.id);
          return <label key={candidate.id} className={`flex items-start gap-3 rounded-lg border p-3 ${checked ? 'border-brand-300 bg-brand-50' : 'border-slate-200'} ${added ? 'text-slate-500' : 'cursor-pointer text-slate-900'}`}>
            <input type="checkbox" checked={checked} disabled={added || saving} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
              onChange={() => { setNotice(''); setSelected(ids => ids.includes(candidate.id) ? ids.filter(id => id !== candidate.id) : [...ids, candidate.id]); }} />
            <span className="min-w-0 flex-1 break-words text-sm">{candidate.chineseMeaning}</span>
            {added && <span className="shrink-0 text-xs">已加入</span>}
          </label>;
        })}</div>
      </fieldset>)}
      <Button className="w-full" disabled={saving || selectedCandidates.length === 0} onClick={() => void save()}>{saving ? '加入中…' : available.length === 0 ? '全部释义已加入' : `加入我的词库 · ${selectedCandidates.length} 个释义`}</Button>
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  </article>;
}
