import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { wordRepository } from '../repositories/wordRepository';
import { localLexicon, normalizeLexiconWord } from '../services/lexicon/localLexicon';

export function LexiconCET6Page() {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(80);
  const entries = useMemo(() => localLexicon.list(), []);
  const words = useLiveQuery(() => wordRepository.list(), []);
  const joinedWords = useMemo(
    () => new Set((words ?? []).map((word) => normalizeLexiconWord(word.word))),
    [words]
  );

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => entry.word.toLowerCase().includes(query));
  }, [entries, search]);

  const joinedCount = entries.filter((entry) =>
    joinedWords.has(normalizeLexiconWord(entry.word))
  ).length;
  const notJoinedCount = entries.length - joinedCount;

  return (
    <>
      <PageHeader
        title="六级词库"
        subtitle="本地 CET6 词典，离线可用。选择义项后才会加入你的词库。"
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="已收录" value={entries.length} />
        <StatCard label="我已加入" value={joinedCount} />
        <StatCard label="我未加入" value={notJoinedCount} />
      </div>

      <input
        value={search}
        onChange={(event) => { setSearch(event.target.value); setVisibleCount(80); }}
        placeholder="搜索六级单词"
        className="mb-5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />

      {filteredEntries.length === 0 ? (
        <EmptyState
          icon="🔎"
          title="没有找到匹配的单词"
          description="换个关键词试试。"
        />
      ) : (
        <div className="space-y-2">
          {filteredEntries.slice(0, visibleCount).map((entry) => {
            const joined = joinedWords.has(normalizeLexiconWord(entry.word));
            return (
              <Link
                key={entry.id}
                to={`/lexicon/cet6/${encodeURIComponent(entry.word)}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold text-slate-900">
                      {entry.word}
                    </span>
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                      CET6
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {entry.phonetic ? `${entry.phonetic} · ` : ''}
                    {entry.senses.length} 个义项
                  </div>
                </div>
                <span className={`shrink-0 text-xs ${joined ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {joined ? '已加入' : '未加入'}
                </span>
              </Link>
            );
          })}
          {visibleCount < filteredEntries.length && <div className="py-4 text-center">
            <p className="mb-3 text-sm text-slate-500">已显示 {visibleCount} / {filteredEntries.length} 个单词</p>
            <Button variant="secondary" onClick={() => setVisibleCount(count => count + 80)}>显示更多</Button>
          </div>}
        </div>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
