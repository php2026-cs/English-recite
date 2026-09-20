import { useMemo, useState } from 'react';
import { localLexicon } from '../services/lexicon/localLexicon';

export default function LexiconWordSuggestions({ query, onSelect }: { query: string; onSelect: (word: string) => void }) {
  const [limit, setLimit] = useState(8);
  const matches = useMemo(() => localLexicon.search(query).sort((a, b) => {
    const value = query.trim().toLowerCase();
    const rank = (word: string) => word === value ? 0 : word.startsWith(value) ? 1 : 2;
    return rank(a.word) - rank(b.word) || a.word.localeCompare(b.word);
  }), [query]);
  return <section aria-label="匹配单词" className="mt-3 rounded-lg border border-slate-200">
    <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{matches.length ? `找到 ${matches.length} 个包含“${query.trim()}”的单词，点击选择` : '本地词库暂无匹配，可点击“获取释义”查询完整单词。'}</p>
    {matches.slice(0, limit).map(entry => <button key={entry.id} type="button" onClick={() => onSelect(entry.word)} className="block w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-brand-50">
      <span className="block break-all font-semibold text-slate-900">{entry.word}</span>
      <span className="mt-1 block truncate text-xs text-slate-500">{entry.senses.slice(0, 3).map(s => `${s.partOfSpeech} ${s.chineseMeaning}`).join('；')}</span>
    </button>)}
    {matches.length > limit && <button type="button" className="w-full p-3 text-sm font-semibold text-slate-700 hover:bg-brand-50" onClick={() => setLimit(value => value + 8)}>显示更多匹配词</button>}
  </section>;
}
