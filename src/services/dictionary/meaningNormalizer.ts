import type { RawDictionaryMeaning } from './dictionaryProvider';
import { normalizePartOfSpeech } from './dictionaryProvider';

const TRAILING_PUNCTUATION = /[。；;，]+$/;
const LEADING_GLOSS_PREFIX = /^(意思是|指的是|表示|用于表示)/;
const SPLIT_SEPARATORS = /[；;\/]/;

export function normalizeChineseMeaning(text: string): string {
  let value = text.trim().replace(/\s+/g, ' ');
  value = value.replace(TRAILING_PUNCTUATION, '');
  value = value.replace(LEADING_GLOSS_PREFIX, '');
  return value.trim();
}

export function splitChineseMeaningText(text: string): string[] {
  const cleaned = normalizeChineseMeaning(text);
  if (!cleaned) return [];
  if (!SPLIT_SEPARATORS.test(cleaned)) return [cleaned];

  return cleaned
    .split(SPLIT_SEPARATORS)
    .map((part) => normalizeChineseMeaning(part))
    .filter(Boolean);
}

export function isLongChineseMeaning(
  text: string,
  threshold = 16
): boolean {
  return Array.from(text).length > threshold;
}

export function normalizeEnhancedMeanings(
  meanings: RawDictionaryMeaning[]
): RawDictionaryMeaning[] {
  const seen = new Set<string>();
  const result: RawDictionaryMeaning[] = [];

  for (const meaning of meanings) {
    const sourceText = meaning.chineseMeaning?.trim() || meaning.translatedDefinition?.trim();
    if (!sourceText) continue;
    const parts = splitChineseMeaningText(sourceText);

    for (const part of parts) {
      const partOfSpeech = normalizePartOfSpeech(meaning.partOfSpeech);
      const key = `${partOfSpeech.toLocaleLowerCase()}|${part}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        partOfSpeech,
        chineseMeaning: part,
        englishDefinition: meaning.englishDefinition,
        translatedDefinition: meaning.translatedDefinition || sourceText
      });
    }
  }

  return result;
}
