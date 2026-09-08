import Dexie, { type EntityTable } from 'dexie';
import type { ReviewRun } from '../core/reviewRun';
import type { PersonalMeaningAlias } from '../core/personalVocabulary';
import type { DictionaryLookupResult } from '../services/dictionary/dictionaryProvider';
import type {
  ConfusionPair,
  Meaning,
  MeaningDifficulty,
  MeaningPerformanceProfile,
  MeaningReviewState,
  ReviewRecord,
  ReviewSession,
  UserSettings,
  Word
} from '../types';

export interface DictionaryCacheEntry {
  normalizedWord: string;
  result: DictionaryLookupResult;
  createdAt: number;
  updatedAt: number;
}

export interface SyncMeta {
  entityKey: string;
  syncStatus: 'synced' | 'dirty';
  deletedAt?: number;
  localOwnerUserId?: string | null;
  updatedAt: number;
}

export class LightWordsDB extends Dexie {
  words!: EntityTable<Word, 'id'>;
  meanings!: EntityTable<Meaning, 'id'>;
  reviewRecords!: EntityTable<ReviewRecord, 'id'>;
  reviewSessions!: EntityTable<ReviewSession, 'id'>;
  dictionaryCache!: EntityTable<DictionaryCacheEntry, 'normalizedWord'>;
  meaningReviewStates!: EntityTable<MeaningReviewState, 'meaningId'>;
  settings!: EntityTable<UserSettings, 'id'>;
  syncMeta!: EntityTable<SyncMeta, 'entityKey'>;
  performanceProfiles!: EntityTable<MeaningPerformanceProfile, 'meaningId'>;
  meaningDifficulties!: EntityTable<MeaningDifficulty, 'meaningId'>;
  confusionPairs!: EntityTable<ConfusionPair, 'id'>;
  activeReviewRuns!: EntityTable<ReviewRun, 'id'>;
  personalMeaningAliases!: EntityTable<PersonalMeaningAlias, 'id'>;

  constructor() {
    super('lightwords');
    this.version(1).stores({
      words: 'id, word, createdAt, updatedAt',
      meanings: 'id, wordId, selectedForStudy, createdAt, updatedAt',
      reviewRecords: 'id, wordId, meaningId, mode, reviewedAt',
      reviewSessions: 'id, wordId, createdAt'
    });
    this.version(2).stores({
      dictionaryCache: 'normalizedWord, updatedAt'
    });
    this.version(3).stores({
      meaningReviewStates: 'meaningId, dueAt, state',
      settings: 'id'
    });
    this.version(4).stores({
      syncMeta: 'entityKey, syncStatus, updatedAt'
    });
    this.version(5).stores({
      performanceProfiles: 'meaningId, updatedAt',
      meaningDifficulties: 'meaningId, updatedAt',
      confusionPairs: 'id, &[wordAId+wordBId], wordAId, wordBId, updatedAt'
    });
    this.version(6).stores({
      words: 'id, word, createdAt, updatedAt, localOwnerUserId',
      meanings: 'id, wordId, selectedForStudy, createdAt, updatedAt, localOwnerUserId',
      meaningReviewStates: 'meaningId, dueAt, state, localOwnerUserId',
      reviewRecords: 'id, wordId, meaningId, mode, reviewedAt, localOwnerUserId',
      reviewSessions: 'id, wordId, createdAt, localOwnerUserId',
      syncMeta: 'entityKey, syncStatus, updatedAt, localOwnerUserId'
    });
    this.version(7).stores({
      activeReviewRuns: 'id, localOwnerUserId, mode, status, updatedAt'
    });
    this.version(8).stores({
      personalMeaningAliases: 'id, meaningId, localOwnerUserId'
    });
  }
}

export const db = new LightWordsDB();
