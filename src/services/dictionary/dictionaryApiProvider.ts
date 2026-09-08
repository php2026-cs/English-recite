import {
  normalizePartOfSpeech,
  type DictionaryLookupResult,
  type RawDictionaryMeaning
} from './dictionaryProvider';

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const MAX_PER_PART_OF_SPEECH = 6;
const MAX_TOTAL_MEANINGS = 30;

interface DictionaryApiDefinition {
  definition: string;
  example?: string;
}

interface DictionaryApiMeaning {
  partOfSpeech: string;
  definitions: DictionaryApiDefinition[];
}

interface DictionaryApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string }>;
  meanings?: DictionaryApiMeaning[];
}

function extractPhonetic(entries: DictionaryApiEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.phonetic?.trim()) return entry.phonetic.trim();
    const fromPhonetics = entry.phonetics?.find((item) => item.text?.trim());
    if (fromPhonetics?.text?.trim()) return fromPhonetics.text.trim();
  }
  return undefined;
}

function deduplicateRawDefinitions(
  meanings: RawDictionaryMeaning[]
): RawDictionaryMeaning[] {
  const seen = new Set<string>();
  const result: RawDictionaryMeaning[] = [];

  for (const meaning of meanings) {
    const english = meaning.englishDefinition?.trim().toLowerCase();
    if (!english) {
      result.push(meaning);
      continue;
    }
    const key = `${meaning.partOfSpeech}|${english}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(meaning);
  }

  return result;
}

function limitRawDefinitions(
  meanings: RawDictionaryMeaning[]
): RawDictionaryMeaning[] {
  const counts = new Map<string, number>();
  const result: RawDictionaryMeaning[] = [];

  for (const meaning of meanings) {
    const currentCount = counts.get(meaning.partOfSpeech) ?? 0;
    if (currentCount >= MAX_PER_PART_OF_SPEECH) continue;
    if (result.length >= MAX_TOTAL_MEANINGS) break;
    counts.set(meaning.partOfSpeech, currentCount + 1);
    result.push(meaning);
  }

  return result;
}

export class DictionaryApiProvider {
  async lookup(word: string): Promise<DictionaryLookupResult> {
    const normalizedWord = word.trim();
    if (!normalizedWord) {
      throw new Error('请输入英文单词。');
    }

    const response = await fetch(
      `${DICTIONARY_API_BASE}/${encodeURIComponent(normalizedWord)}`
    );
    if (!response.ok) {
      throw new Error('暂时无法获取该单词的释义。');
    }

    const entries = (await response.json()) as DictionaryApiEntry[];
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('没有找到该单词的释义。');
    }

    const rawMeanings: RawDictionaryMeaning[] = [];
    for (const entry of entries) {
      for (const meaning of entry.meanings ?? []) {
        for (const definition of meaning.definitions ?? []) {
          if (definition.definition.trim()) {
            rawMeanings.push({
              partOfSpeech: normalizePartOfSpeech(meaning.partOfSpeech),
              chineseMeaning: '',
              englishDefinition: definition.definition.trim()
            });
          }
        }
      }
    }

    return {
      word: entries[0].word || normalizedWord,
      phonetic: extractPhonetic(entries),
      meanings: limitRawDefinitions(deduplicateRawDefinitions(rawMeanings))
    };
  }
}
