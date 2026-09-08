import type { DictionaryLookupResult } from './dictionaryProvider';

export interface DictionaryCacheStore {
  get(normalizedWord: string): Promise<DictionaryLookupResult | undefined>;
  set(normalizedWord: string, result: DictionaryLookupResult): Promise<void>;
}

export function normalizeDictionaryWord(word: string): string {
  return word.trim().toLowerCase();
}

export class MemoryDictionaryCache implements DictionaryCacheStore {
  private readonly entries = new Map<string, DictionaryLookupResult>();

  async get(normalizedWord: string): Promise<DictionaryLookupResult | undefined> {
    return this.entries.get(normalizedWord);
  }

  async set(normalizedWord: string, result: DictionaryLookupResult): Promise<void> {
    this.entries.set(normalizedWord, result);
  }
}
