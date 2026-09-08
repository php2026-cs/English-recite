import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../../db/db';
import type {
  Meaning,
  MeaningReviewState,
  ReviewRecord,
  Word
} from '../../types';
import {
  mergeAppendOnlyById,
  resolveLastWriteWins,
  resolveMeaningReviewState
} from './conflictResolver';
import { syncMetaRepository } from './syncMetaRepository';
import {
  meaningFromRemote,
  meaningToRemote,
  reviewRecordFromRemote,
  reviewRecordToRemote,
  reviewStateFromRemote,
  reviewStateToRemote,
  wordFromRemote,
  wordToRemote
} from './supabaseMappers';

interface CloudWord {
  id: string;
  word: string;
  normalized_word: string;
  phonetic?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CloudMeaning {
  id: string;
  word_id: string;
  part_of_speech: string;
  chinese_meaning: string;
  selected_for_study: boolean;
  correct_count: number;
  incorrect_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CloudReviewState {
  meaning_id: string;
  state: MeaningReviewState['state'];
  due_at: string;
  last_review_at: string | null;
  stability: number | null;
  difficulty: number | null;
  reps: number;
  lapses: number;
  elapsed_days: number | null;
  scheduled_days: number | null;
  fsrs_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface CloudReviewRecord {
  id: string;
  word_id: string;
  meaning_id: string;
  mode: 'zh-to-en' | 'en-to-zh';
  result: 'again' | 'hard' | 'good' | 'easy';
  correct: boolean;
  reviewed_at: string;
  previous_due_at: string | null;
  next_due_at: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export class SyncEngine {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async sync(userId: string): Promise<void> {
    await this.push(userId);
    await this.pull(userId);
  }

  async push(userId: string): Promise<void> {
    const dirty = await syncMetaRepository.listDirty();
    const wordIds = new Set<string>();
    const meaningIds = new Set<string>();
    const reviewStateIds = new Set<string>();
    const recordIds = new Set<string>();

    for (const meta of dirty) {
      const [kind, id] = meta.entityKey.split(':');
      if (kind === 'word') wordIds.add(id);
      if (kind === 'meaning') meaningIds.add(id);
      if (kind === 'review') recordIds.add(id);
      if (kind === 'review-state') reviewStateIds.add(id);
    }

    for (const id of wordIds) {
      const word = await db.words.get(id);
      await this.upsertWord(userId, word);
      await syncMetaRepository.markSynced(`word:${id}`);
    }
    for (const id of meaningIds) {
      const meaning = await db.meanings.get(id);
      await this.upsertMeaning(userId, meaning);
      await syncMetaRepository.markSynced(`meaning:${id}`);
    }
    for (const id of recordIds) {
      const record = await db.reviewRecords.get(id);
      await this.insertReviewRecord(userId, record);
      await syncMetaRepository.markSynced(`review:${id}`);
    }
    for (const id of reviewStateIds) {
      const state = await db.meaningReviewStates.get(id);
      await this.upsertReviewState(userId, state);
      await syncMetaRepository.markSynced(`review-state:${id}`);
    }
  }

  async pull(userId: string): Promise<void> {
    const words = await this.fetchWords(userId);
    for (const cloud of words) {
      const local = await db.words.get(cloud.id);
      if (cloud.deleted_at) {
        await db.words.delete(cloud.id);
        continue;
      }
      const next = resolveLastWriteWins(
        local ?? wordFromRemote(cloud),
        wordFromRemote(cloud)
      );
      next.localOwnerUserId = userId;
      await db.words.put(next);
    }

    const meanings = await this.fetchMeanings(userId);
    for (const cloud of meanings) {
      const local = await db.meanings.get(cloud.id);
      if (cloud.deleted_at) {
        await db.meanings.delete(cloud.id);
        continue;
      }
      const next = resolveLastWriteWins(
        local ?? meaningFromRemote(cloud),
        meaningFromRemote(cloud)
      );
      next.localOwnerUserId = userId;
      await db.meanings.put(next);
    }

    const states = await this.fetchReviewStates(userId);
    for (const cloud of states) {
      const local = await db.meaningReviewStates.get(cloud.meaning_id);
      const next = resolveMeaningReviewState(
        local,
        reviewStateFromRemote(cloud)
      );
      if (next) {
        next.localOwnerUserId = userId;
        await db.meaningReviewStates.put(next);
      }
    }

    const remoteRecords = await this.fetchReviewRecords(userId);
    const localRecords = (await db.reviewRecords.toArray()).filter(
      (record) => (record.localOwnerUserId ?? null) === userId
    );
    const merged = mergeAppendOnlyById(localRecords, remoteRecords);
    for (const record of merged) {
      record.localOwnerUserId = userId;
      await db.reviewRecords.put(record);
    }
  }

  private async upsertWord(userId: string, word?: Word): Promise<void> {
    if (!word) return;
    const { error } = await this.supabaseClient
      .from('user_words')
      .upsert({ ...wordToRemote(word), user_id: userId });
    if (error) throw error;
  }

  private async upsertMeaning(userId: string, meaning?: Meaning): Promise<void> {
    if (!meaning) return;
    const { error } = await this.supabaseClient
      .from('user_meanings')
      .upsert({ ...meaningToRemote(meaning), user_id: userId });
    if (error) throw error;
  }

  private async insertReviewRecord(
    userId: string,
    record?: ReviewRecord
  ): Promise<void> {
    if (!record || !record.meaningId) return;
    const { error } = await this.supabaseClient
      .from('review_records')
      .upsert({ ...reviewRecordToRemote(record), user_id: userId });
    if (error) throw error;
  }

  private async upsertReviewState(
    userId: string,
    state?: MeaningReviewState
  ): Promise<void> {
    if (!state) return;
    const { error } = await this.supabaseClient
      .from('meaning_review_states')
      .upsert({ ...reviewStateToRemote(state), user_id: userId });
    if (error) throw error;
  }

  private async fetchWords(userId: string): Promise<CloudWord[]> {
    const { data } = await this.supabaseClient
      .from('user_words')
      .select('*')
      .eq('user_id', userId);
    return (data ?? []) as CloudWord[];
  }

  private async fetchMeanings(userId: string): Promise<CloudMeaning[]> {
    const { data } = await this.supabaseClient
      .from('user_meanings')
      .select('*')
      .eq('user_id', userId);
    return (data ?? []) as CloudMeaning[];
  }

  private async fetchReviewStates(userId: string): Promise<CloudReviewState[]> {
    const { data } = await this.supabaseClient
      .from('meaning_review_states')
      .select('*')
      .eq('user_id', userId);
    return (data ?? []) as CloudReviewState[];
  }

  private async fetchReviewRecords(userId: string): Promise<ReviewRecord[]> {
    const { data } = await this.supabaseClient
      .from('review_records')
      .select('*')
      .eq('user_id', userId);
    return ((data ?? []) as CloudReviewRecord[]).map(reviewRecordFromRemote);
  }
}
