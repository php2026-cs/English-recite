import data from '../../data/lexicon/aliases.json';
import { normalizeChinese } from '../../lib/strings';
import type { Meaning } from '../../types';

type AliasSense = { partOfSpeech: string; chineseMeaning: string; aliases: string[] };
export function getAliasSenses(word: string): AliasSense[] {
  return (data as Record<string, AliasSense[]>)[word.trim().toLowerCase()] ?? [];
}

export function getLexiconAliases(word: string, meanings: Meaning[]): Map<string, string[]> {
  const senses = getAliasSenses(word);
  return new Map(meanings.map(meaning => [meaning.id, senses.filter(sense =>
    sense.partOfSpeech === meaning.partOfSpeech &&
    normalizeChinese(sense.chineseMeaning) === normalizeChinese(meaning.chineseMeaning)
  ).flatMap(sense => sense.aliases)]));
}
