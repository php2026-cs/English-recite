import type { LexiconEntry } from '../data/lexicon/types';
import type { ReviewRunItem } from './reviewRun';
import { normalizeChinese } from '../lib/strings';

export interface ReviewChoice { id: string; label: string; sourceWord: string; meaningIds: string[] }
export function spellingDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

export function buildReviewChoices(item: ReviewRunItem, direction: 'en-zh' | 'zh-en', entries: LexiconEntry[]): ReviewChoice[] {
  const word = item.word.word.trim().toLowerCase();
  const options: ReviewChoice[] = [];
  const labels = new Set<string>();
  if (direction === 'zh-en') options.push({ id: 'correct-word', label: item.word.word, sourceWord: word, meaningIds: item.meanings.map(m => m.id) });
  else for (const meaning of item.meanings) {
    const label = `${meaning.partOfSpeech} ${meaning.chineseMeaning}`;
    const same = options.find(option => option.label === label);
    if (same) same.meaningIds.push(meaning.id);
    else options.push({ id: `correct-${meaning.id}`, label, sourceWord: word, meaningIds: [meaning.id] });
  }
  options.forEach(option => labels.add(option.label.toLowerCase()));
  // Exclude every known target sense/alias, even senses outside this review batch.
  const target = entries.find(entry => entry.word.toLowerCase() === word);
  const excluded = new Set([...item.meanings.map(m => m.chineseMeaning), ...(target?.senses.flatMap(s => [s.chineseMeaning, ...(s.aliases ?? [])]) ?? [])]
    .flatMap(gloss => [gloss, ...gloss.split(/[，,；;、]/)]).map(normalizeChinese).filter(Boolean));
  const ranked = entries.filter(entry => entry.word.toLowerCase() !== word).map(entry => ({ entry, distance: spellingDistance(word, entry.word.toLowerCase()) }))
    .sort((a, b) => a.distance - b.distance || a.entry.word.localeCompare(b.entry.word));
  const desired = options.length + (direction === 'zh-en' ? 3 : Math.max(3, Math.min(5, options.length)));
  for (const { entry } of ranked) {
    if (options.length >= desired) break;
    if (direction === 'zh-en' && entry.senses.some(s => [s.chineseMeaning, ...s.chineseMeaning.split(/[，,；;、]/), ...(s.aliases ?? [])].some(gloss => excluded.has(normalizeChinese(gloss))))) continue;
    const sense = [...entry.senses].sort((a, b) => Number(item.meanings.some(m => m.partOfSpeech === b.partOfSpeech)) - Number(item.meanings.some(m => m.partOfSpeech === a.partOfSpeech)))
      .find(s => ![s.chineseMeaning, ...s.chineseMeaning.split(/[，,；;、]/), ...(s.aliases ?? [])].some(gloss => excluded.has(normalizeChinese(gloss))));
    if (!sense) continue;
    const label = direction === 'zh-en' ? entry.word : `${sense.partOfSpeech} ${sense.chineseMeaning}`;
    if (labels.has(label.toLowerCase())) continue;
    labels.add(label.toLowerCase());
    options.push({ id: `distractor-${entry.id}`, label, sourceWord: entry.word, meaningIds: [] });
  }
  let seed = Array.from(item.taskId).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 1);
  for (let i = options.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1); [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
