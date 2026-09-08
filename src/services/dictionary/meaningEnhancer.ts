import type { RawDictionaryMeaning } from './dictionaryProvider';

export type EnhancedMeaning = RawDictionaryMeaning;

export interface MeaningEnhancer {
  enhance(
    word: string,
    meanings: RawDictionaryMeaning[]
  ): Promise<EnhancedMeaning[]>;
}
