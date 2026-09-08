import type { RawDictionaryMeaning } from './dictionaryProvider';
import type { EnhancedMeaning, MeaningEnhancer } from './meaningEnhancer';

const TRANSLATION_API_BASE = 'https://api.mymemory.translated.net/get';
const DEFAULT_CONCURRENCY = 4;

async function translateToChinese(text: string): Promise<string> {
  const url = `${TRANSLATION_API_BASE}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent('en|zh-CN')}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('translation request failed');
  const data = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };
  const translated = data.responseData?.translatedText?.trim();
  if (
    translated &&
    translated !== 'NO QUERY SPECIFIED' &&
    !translated.toUpperCase().includes('MYMEMORY WARNING')
  ) {
    return translated;
  }
  return text;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export class MyMemoryMeaningEnhancer implements MeaningEnhancer {
  async enhance(
    _word: string,
    meanings: RawDictionaryMeaning[]
  ): Promise<EnhancedMeaning[]> {
    const uniqueDefinitions = new Map<string, RawDictionaryMeaning>();
    for (const meaning of meanings) {
      const english = meaning.englishDefinition?.trim();
      if (!english) continue;
      if (!uniqueDefinitions.has(english)) {
        uniqueDefinitions.set(english, meaning);
      }
    }

    const entries = [...uniqueDefinitions.entries()];
    const translations = await mapWithConcurrency(
      entries,
      DEFAULT_CONCURRENCY,
      async ([english]) => {
        try {
          return await translateToChinese(english);
        } catch {
          return english;
        }
      }
    );

    const translationByEnglish = new Map(
      entries.map(([english], index) => [english, translations[index]])
    );

    return meanings.map((meaning) => {
      const english = meaning.englishDefinition?.trim() ?? '';
      const translatedDefinition = english
        ? translationByEnglish.get(english) ?? ''
        : '';
      return {
        ...meaning,
        translatedDefinition,
        chineseMeaning: translatedDefinition
      };
    });
  }
}
