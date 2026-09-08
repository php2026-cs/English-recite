export interface RawDictionaryMeaning {
  partOfSpeech: string;
  chineseMeaning: string;
  englishDefinition?: string;
  translatedDefinition?: string;
}

export interface DictionaryLookupResult {
  word: string;
  phonetic?: string;
  meanings: RawDictionaryMeaning[];
}

export interface DictionaryProvider {
  lookup(word: string): Promise<DictionaryLookupResult>;
}

const PART_OF_SPEECH_ALIASES: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  numeral: 'num.',
  interjection: 'interj.',
  'phrasal verb': 'phrase',
  'transitive verb': 'v.',
  'intransitive verb': 'v.'
};

export function normalizePartOfSpeech(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return PART_OF_SPEECH_ALIASES[cleaned] ?? value.trim();
}

export function deduplicateLookupMeanings(
  meanings: DictionaryLookupResult['meanings']
): DictionaryLookupResult['meanings'] {
  const seen = new Set<string>();
  const result: DictionaryLookupResult['meanings'] = [];

  for (const meaning of meanings) {
    const partOfSpeech = normalizePartOfSpeech(meaning.partOfSpeech);
    const chineseMeaning = meaning.chineseMeaning.trim();
    if (!partOfSpeech || !chineseMeaning) continue;
    const key = `${partOfSpeech.toLocaleLowerCase()}|${chineseMeaning}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      partOfSpeech,
      chineseMeaning,
      englishDefinition: meaning.englishDefinition,
      translatedDefinition: meaning.translatedDefinition
    });
  }

  return result;
}
