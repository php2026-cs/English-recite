import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { CandidateMeaningCard } from '../components/CandidateMeaningCard';
import { MeaningEditor } from '../components/MeaningEditor';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { meaningRepository, type MeaningInput } from '../repositories/meaningRepository';
import { wordRepository } from '../repositories/wordRepository';
import {
  createCandidateMeaning,
  deduplicateCandidates,
  groupCandidatesByPartOfSpeech,
  removeCandidateMeaning,
  setGroupSelected,
  toMeaningInput,
  toggleCandidateMeaning,
  updateCandidateMeaning,
  type CandidateMeaning
} from '../services/dictionary/candidates';
import { dictionaryService } from '../services/dictionary/dictionaryService';
import { resolveCandidatesFromLocalFirst } from '../services/lexicon/localLexicon';
import type { Word } from '../types';

export function WordNewPage() {
  const navigate = useNavigate();
  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [candidates, setCandidates] = useState<CandidateMeaning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingWord, setExistingWord] = useState<Word | null>(null);
  const [saving, setSaving] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canLookup = word.trim().length > 0 && !loading;

  async function handleLookup(forceRefresh = false) {
    if (!canLookup) return;
    setLoading(true);
    setError(null);
    setExistingWord(null);
    setCacheNotice(null);

    try {
      const existing = await wordRepository.findByNormalizedWord(word);
      if (existing) {
        setExistingWord(existing);
        return;
      }

      const resolved = await resolveCandidatesFromLocalFirst(word, (lookupWord) =>
        dictionaryService.lookup(lookupWord, { forceRefresh })
      );

      if (resolved.phonetic && !phonetic.trim()) {
        setPhonetic(resolved.phonetic);
      }
      if (resolved.source === 'lexicon') {
        setCacheNotice('CET6 本地词库');
      } else if (resolved.fromCache) {
        setCacheNotice('使用本地缓存释义。');
      }

      setCandidates((current) =>
        deduplicateCandidates([
          ...current.filter(
            (candidate) =>
              candidate.source !== 'dictionary' && candidate.source !== 'lexicon'
          ),
          ...resolved.candidates
        ])
      );
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : '暂时无法获取释义，你仍然可以手动添加。'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleWordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleLookup();
    }
  }

  function openCreateEditor() {
    setEditingId(null);
    setEditorOpen(true);
  }

  function openEditEditor(candidate: CandidateMeaning) {
    setEditingId(candidate.id);
    setEditorOpen(true);
  }

  function handleEditorSubmit(input: MeaningInput) {
    if (editingId) {
      setCandidates((current) =>
        deduplicateCandidates(updateCandidateMeaning(current, editingId, input))
      );
    } else {
      setCandidates((current) =>
        deduplicateCandidates([...current, createCandidateMeaning(input, 'manual')])
      );
    }
    setEditorOpen(false);
    setEditingId(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!word.trim() || saving || existingWord) return;

    setSaving(true);
    try {
      const created = await wordRepository.create({
        word,
        phonetic: phonetic || undefined
      });

      for (const candidate of candidates) {
        await meaningRepository.create(created.id, toMeaningInput(candidate));
      }

      navigate(`/words/${created.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  const editingCandidate = editingId
    ? candidates.find((candidate) => candidate.id === editingId)
    : undefined;
  const candidateGroups = groupCandidatesByPartOfSpeech(candidates);
  const selectedCount = candidates.filter((candidate) => candidate.selectedForStudy).length;
  const hasLocalLexicon = candidates.some((candidate) => candidate.source === 'lexicon');

  return (
    <>
      <PageHeader title="添加单词" subtitle="输入英文，获取候选释义后快速勾选。" />

      <form onSubmit={handleSave}>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <label htmlFor="new-word" className="mb-1.5 block text-sm font-medium text-slate-700">
              英文单词
            </label>
            <div className="flex gap-2">
              <input
                id="new-word"
                autoFocus
                value={word}
                onChange={(event) => setWord(event.target.value)}
                onKeyDown={handleWordKeyDown}
                placeholder="例如：charge"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <Button
                type="button"
                onClick={() => void handleLookup()}
                disabled={!canLookup}
                className="shrink-0"
              >
                {loading ? '正在获取释义…' : '获取释义'}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">按 Enter 也可以直接获取释义。</p>
          </div>

          <div className="mt-4">
            <label htmlFor="new-phonetic" className="mb-1.5 block text-sm font-medium text-slate-700">
              音标（可选）
            </label>
            <input
              id="new-phonetic"
              value={phonetic}
              onChange={(event) => setPhonetic(event.target.value)}
              placeholder="例如：/tʃɑːrdʒ/"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {existingWord ? (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">这个单词已经在词库中。</p>
              <p className="mt-1 text-amber-700">
                “{existingWord.word}” 已存在，不需要重复创建。
              </p>
              <Link
                to={`/words/${existingWord.id}`}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
              >
                打开现有单词
              </Link>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>{error}</p>
              <p className="mt-1 text-slate-500">你仍然可以手动添加中文释义。</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void handleLookup(true)}
                disabled={loading}
              >
                重新获取
              </Button>
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">候选释义</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                勾选的义项会进入背诵范围。
                {hasLocalLexicon ? (
                  <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                    CET6
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {cacheNotice ? (
                <span className="text-xs text-brand-700">{cacheNotice}</span>
              ) : null}
              {candidates.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleLookup(true)}
                  disabled={loading}
                  className="text-sm text-brand-700 hover:text-brand-600 disabled:text-slate-400"
                >
                  重新获取
                </button>
              ) : null}
            </div>
          </div>

          {candidates.length > 0 ? (
            <div className="space-y-5">
              {candidateGroups.map((group) => {
                const allSelected = group.candidates.every(
                  (candidate) => candidate.selectedForStudy
                );
                return (
                  <div key={group.partOfSpeech}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {group.partOfSpeech}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCandidates((current) =>
                            setGroupSelected(
                              current,
                              group.partOfSpeech,
                              !allSelected
                            )
                          )
                        }
                        className="text-xs font-medium text-brand-700 hover:text-brand-600"
                      >
                        {allSelected ? '取消全选' : '全选'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {group.candidates.map((candidate) => (
                        <CandidateMeaningCard
                          key={candidate.id}
                          candidate={candidate}
                          onToggle={(selected) =>
                            setCandidates((current) =>
                              toggleCandidateMeaning(current, selected.id)
                            )
                          }
                          onEdit={openEditEditor}
                          onDelete={(selected) =>
                            setCandidates((current) =>
                              removeCandidateMeaning(current, selected.id)
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              点击“获取释义”自动生成候选，或点击下方按钮手动添加。
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={openCreateEditor}
          >
            ＋ 添加自定义释义
          </Button>

          <Button
            type="submit"
            disabled={!word.trim() || saving || existingWord !== null}
            className="mt-4 w-full"
          >
            {saving
              ? '保存中…'
              : `保存单词 · ${selectedCount} 个释义`}
          </Button>
        </section>
      </form>

      <Modal
        open={editorOpen}
        title={editingCandidate ? '编辑候选释义' : '添加自定义释义'}
        onClose={() => {
          setEditorOpen(false);
          setEditingId(null);
        }}
      >
        <MeaningEditor
          initialValue={
            editingCandidate
              ? {
                  partOfSpeech: editingCandidate.partOfSpeech,
                  chineseMeaning: editingCandidate.chineseMeaning,
                  selectedForStudy: editingCandidate.selectedForStudy
                }
              : undefined
          }
          submitText={editingCandidate ? '保存修改' : '添加'}
          onCancel={() => {
            setEditorOpen(false);
            setEditingId(null);
          }}
          onSubmit={handleEditorSubmit}
        />
      </Modal>
    </>
  );
}
