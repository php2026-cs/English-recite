import { normalizeDictionaryWord, type DictionaryCacheStore } from './dictionaryCache';
import type { MeaningEnhancer } from './meaningEnhancer';
import { normalizeEnhancedMeanings } from './meaningNormalizer';
import type { DictionaryLookupResult, DictionaryProvider } from './dictionaryProvider';

export interface DictionaryLookupOptions {
  forceRefresh?: boolean;
}

export type DictionaryLookupResponse = DictionaryLookupResult & {
  fromCache: boolean;
};

export class DictionaryServiceCore {
  constructor(
    private readonly provider: DictionaryProvider,
    private readonly enhancer: MeaningEnhancer,
    private readonly cache: DictionaryCacheStore
  ) {}

  async lookup(
    word: string,
    options: DictionaryLookupOptions = {}
  ): Promise<DictionaryLookupResponse> {
    const normalizedWord = normalizeDictionaryWord(word);
    if (!normalizedWord) {
      throw new Error('请输入英文单词。');
    }

    if (!options.forceRefresh) {
      const cached = await this.cache.get(normalizedWord);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    try {
      const raw = await this.provider.lookup(normalizedWord);
      const enhanced = await this.enhancer.enhance(normalizedWord, raw.meanings);
      const result: DictionaryLookupResult = {
        ...raw,
        meanings: normalizeEnhancedMeanings(enhanced)
      };
      await this.cache.set(normalizedWord, result);
      return { ...result, fromCache: false };
    } catch (error) {
      console.error('[dictionary] lookup failed', error);

      if (!options.forceRefresh) {
        const cached = await this.cache.get(normalizedWord);
        if (cached) {
          return { ...cached, fromCache: true };
        }
      }

      throw new Error('当前无法联网获取释义，你仍然可以手动添加。');
    }
  }
}
