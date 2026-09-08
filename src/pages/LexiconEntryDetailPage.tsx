import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LexiconSenseCard } from '../components/LexiconSenseCard';
import { PageHeader } from '../components/PageHeader';
import { meaningRepository } from '../repositories/meaningRepository';
import { wordRepository } from '../repositories/wordRepository';
import {
  lexiconSenseToCandidate,
  localLexicon,
  normalizeLexiconWord
} from '../services/lexicon/localLexicon';
import { filterMissingCandidates } from '../services/dictionary/candidates';
import type { LexiconSense } from '../data/lexicon/types';

export function LexiconEntryDetailPage() {
  const { word = '' } = useParams();
  const navigate = useNavigate();
  const entry = localLexicon.lookup(decodeURIComponent(word));
  const words = useLiveQuery(() => wordRepository.list(), []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const existingWord = useMemo(() => {
    if (!entry || !words) return undefined;
    return words.find(
      (item) => normalizeLexiconWord(item.word) === normalizeLexiconWord(entry.word)
    );
  }, [entry, words]);

  const groupedSenses = useMemo(() => {
    if (!entry) return [];
    const groups: Array<{ partOfSpeech: string; senses: LexiconSense[] }> = [];
    const indexes = new Map<string, number>();
    for (const sense of entry.senses) {
      const index = indexes.get(sense.partOfSpeech);
      if (index === undefined) {
        indexes.set(sense.partOfSpeech, groups.length);
        groups.push({ partOfSpeech: sense.partOfSpeech, senses: [sense] });
      } else {
        groups[index].senses.push(sense);
      }
    }
    return groups;
  }, [entry]);

  if (!entry) {
    return (
      <EmptyState
        icon="🔎"
        title="没有找到这个六级单词"
        description="它可能不在当前 CET6 本地词库中。"
      />
    );
  }

  const currentEntry = entry;

  function toggleSense(sense: LexiconSense) {
    setSelectedIds((current) =>
      current.includes(sense.id)
        ? current.filter((id) => id !== sense.id)
        : [...current, sense.id]
    );
  }

  async function addSelectedToMyWords() {
    if (saving || selectedIds.length === 0) return;
    setSaving(true);
    try {
      let targetWordId: string;
      let existingMeanings: Array<{ partOfSpeech: string; chineseMeaning: string }> = [];
      if (existingWord) {
        targetWordId = existingWord.id;
        existingMeanings = existingWord.meanings;
      } else {
        const created = await wordRepository.create({
          word: currentEntry.word,
          phonetic: currentEntry.phonetic
        });
        targetWordId = created.id;
      }

      const selectedSenses = currentEntry.senses.filter((sense) =>
        selectedIds.includes(sense.id)
      );
      const missingCandidates = filterMissingCandidates(
        existingMeanings,
        selectedSenses.map(lexiconSenseToCandidate)
      );

      for (const candidate of missingCandidates) {
        await meaningRepository.create(targetWordId, {
          partOfSpeech: candidate.partOfSpeech,
          chineseMeaning: candidate.chineseMeaning,
          selectedForStudy: true
        });
      }

      navigate(`/words/${targetWordId}`);
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selectedIds.length;

  return (
    <>
      <PageHeader
        title={entry.word}
        subtitle={entry.phonetic ? `音标：${entry.phonetic}` : '选择要加入背诵的义项。'}
        action={
          <span className="rounded bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
            CET6
          </span>
        }
      />

      <div className="space-y-5">
        {groupedSenses.map((group) => (
          <div key={group.partOfSpeech}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.partOfSpeech}
            </div>
            <div className="space-y-2">
              {group.senses.map((sense) => (
                <LexiconSenseCard
                  key={sense.id}
                  sense={sense}
                  selected={selectedIds.includes(sense.id)}
                  onToggle={toggleSense}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Button
          disabled={selectedCount === 0 || saving}
          onClick={() => void addSelectedToMyWords()}
          className="w-full"
        >
          {saving
            ? '加入中…'
            : `加入我的词库 · ${selectedCount} 个释义`}
        </Button>
        {existingWord ? (
          <p className="mt-2 text-center text-xs text-slate-500">
            该单词已在我的词库中，本次只会补充未添加的义项。
          </p>
        ) : null}
      </div>
    </>
  );
}
