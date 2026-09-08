import { db } from '../db/db';
import { createId, now } from '../lib/id';
import { normalizeEnglish } from '../lib/strings';
import { syncMetaRepository } from '../services/sync/syncMetaRepository';
import {
  getCurrentOwnerUserId
} from '../services/ownership/ownership';
import type { Meaning, Word, WordWithMeanings } from '../types';

export interface CreateWordInput {
  word: string;
  phonetic?: string;
}

export interface UpdateWordInput {
  word?: string;
  phonetic?: string;
}

export interface LibraryStats {
  wordCount: number;
  meaningCount: number;
  selectedMeaningCount: number;
}

export const wordRepository = {
  async list(search = ''): Promise<WordWithMeanings[]> {
    const words = await db.words.orderBy('updatedAt').reverse().toArray();
    const meanings = await db.meanings.toArray();
    const meaningMap = new Map<string, Meaning[]>();
    for (const meaning of meanings) {
      const list = meaningMap.get(meaning.wordId) ?? [];
      list.push(meaning);
      meaningMap.set(meaning.wordId, list);
    }

    const normalizedSearch = search.trim().toLowerCase();
    return words
      .filter((word) => !normalizedSearch || word.word.toLowerCase().includes(normalizedSearch))
      .filter((word) => (word.localOwnerUserId ?? null) === getCurrentOwnerUserId())
      .map((word) => ({
        ...word,
        meanings: (meaningMap.get(word.id) ?? []).sort((a, b) => a.createdAt - b.createdAt)
      }));
  },

  async get(wordId: string): Promise<Word | undefined> {
    const word = await db.words.get(wordId);
    return word && (word.localOwnerUserId ?? null) === getCurrentOwnerUserId()
      ? word
      : undefined;
  },

  async getWithMeanings(wordId: string): Promise<WordWithMeanings | undefined> {
    const word = await db.words.get(wordId);
    if (!word) return undefined;
    if ((word.localOwnerUserId ?? null) !== getCurrentOwnerUserId()) return undefined;
    const meanings = await db.meanings.where('wordId').equals(wordId).sortBy('createdAt');
    return { ...word, meanings };
  },

  async findByNormalizedWord(value: string): Promise<Word | undefined> {
    const normalized = normalizeEnglish(value);
    if (!normalized) return undefined;
    const words = await db.words.toArray();
    return words.find(
      (word) =>
        normalizeEnglish(word.word) === normalized &&
        (word.localOwnerUserId ?? null) === getCurrentOwnerUserId()
    );
  },

  async create(input: CreateWordInput): Promise<Word> {
    const timestamp = now();
    const word: Word = {
      id: createId(),
      word: input.word.trim(),
      phonetic: input.phonetic?.trim() || undefined,
      localOwnerUserId: getCurrentOwnerUserId(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await db.words.add(word);
    await syncMetaRepository.markDirty(`word:${word.id}`, word.updatedAt);
    return word;
  },

  async update(wordId: string, input: UpdateWordInput): Promise<Word | undefined> {
    const existing = await db.words.get(wordId);
    if (!existing) return undefined;
    const changes: Partial<Word> = { updatedAt: now() };
    if (input.word !== undefined) changes.word = input.word.trim();
    if (input.phonetic !== undefined) changes.phonetic = input.phonetic.trim() || undefined;
    await db.words.update(wordId, changes);
    await syncMetaRepository.markDirty(`word:${wordId}`, changes.updatedAt ?? Date.now());
    return db.words.get(wordId);
  },

  async remove(wordId: string): Promise<void> {
    await db.transaction(
      'rw',
      db.words,
      db.meanings,
      db.reviewRecords,
      db.reviewSessions,
      async () => {
        await db.meanings.where('wordId').equals(wordId).delete();
        await db.reviewRecords.where('wordId').equals(wordId).delete();
        await db.reviewSessions.where('wordId').equals(wordId).delete();
        await db.words.delete(wordId);
        await syncMetaRepository.markDeleted(`word:${wordId}`);
      }
    );
  },

  async getStats(): Promise<LibraryStats> {
    const [wordCount, meanings, selectedMeaningCount] = await Promise.all([
      db.words.filter((word) => (word.localOwnerUserId ?? null) === getCurrentOwnerUserId()).count(),
      db.meanings.filter((meaning) => (meaning.localOwnerUserId ?? null) === getCurrentOwnerUserId()).toArray(),
      db.meanings
        .filter(
          (meaning) =>
            meaning.selectedForStudy &&
            (meaning.localOwnerUserId ?? null) === getCurrentOwnerUserId()
        )
        .count()
    ]);
    return {
      wordCount,
      meaningCount: meanings.length,
      selectedMeaningCount
    };
  }
};
