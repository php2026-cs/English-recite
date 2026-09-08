import { db } from '../db/db';
import type { DictionaryLookupResult } from '../services/dictionary/dictionaryProvider';

export const dictionaryCacheRepository = {
  async get(normalizedWord: string): Promise<DictionaryLookupResult | undefined> {
    const entry = await db.dictionaryCache.get(normalizedWord);
    return entry?.result;
  },

  async set(normalizedWord: string, result: DictionaryLookupResult): Promise<void> {
    const existing = await db.dictionaryCache.get(normalizedWord);
    const timestamp = Date.now();
    await db.dictionaryCache.put({
      normalizedWord,
      result,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    });
  }
};
