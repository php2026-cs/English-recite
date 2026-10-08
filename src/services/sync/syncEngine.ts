import type { SupabaseClient } from '@supabase/supabase-js';
import { db, type SyncMeta } from '../../db/db';
import type { MeaningReviewState, ReviewRecord } from '../../types';
import {
  mergeAppendOnlyByIdPreservingLocal,
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

// PostgREST caps a response at the project's max-rows setting; page below that cap.
const FETCH_PAGE_SIZE = 500;

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

    for (const meta of dirty) {
      const separator = meta.entityKey.indexOf(':');
      const kind = meta.entityKey.slice(0, separator);
      const id = meta.entityKey.slice(separator + 1);
      // A tombstone means the local row is already gone, so the remote row has to
      // be removed explicitly. Skipping it here would let the next pull resurrect it.
      if (kind === 'word') await this.pushWord(userId, id, meta);
      else if (kind === 'meaning') await this.pushMeaning(userId, id, meta);
      else if (kind === 'review') await this.pushReviewRecord(userId, id, meta);
      else if (kind === 'review-state') await this.pushReviewState(userId, id, meta);
    }
  }

  private async pushWord(userId: string, id: string, meta: SyncMeta): Promise<void> {
    const word = meta.deletedAt ? undefined : await db.words.get(id);
    if (word) {
      const { error } = await this.supabaseClient
        .from('user_words')
        .upsert({ ...wordToRemote(word), user_id: userId });
      if (error) throw error;
    } else if (meta.deletedAt) {
      await this.deleteRemote('user_words', userId, 'id', id);
    }
    await syncMetaRepository.markSynced(`word:${id}`, meta.updatedAt);
  }

  private async pushMeaning(userId: string, id: string, meta: SyncMeta): Promise<void> {
    const meaning = meta.deletedAt ? undefined : await db.meanings.get(id);
    if (meaning) {
      const { error } = await this.supabaseClient
        .from('user_meanings')
        .upsert({ ...meaningToRemote(meaning), user_id: userId });
      if (error) throw error;
    } else if (meta.deletedAt) {
      await this.deleteRemote('user_meanings', userId, 'id', id);
    }
    await syncMetaRepository.markSynced(`meaning:${id}`, meta.updatedAt);
  }

  private async pushReviewRecord(userId: string, id: string, meta: SyncMeta): Promise<void> {
    const record = meta.deletedAt ? undefined : await db.reviewRecords.get(id);
    if (record && record.meaningId) {
      const { error } = await this.supabaseClient
        .from('review_records')
        .upsert({ ...reviewRecordToRemote(record), user_id: userId });
      if (error) throw error;
    } else if (meta.deletedAt) {
      await this.deleteRemote('review_records', userId, 'id', id);
    }
    await syncMetaRepository.markSynced(`review:${id}`, meta.updatedAt);
  }

  private async pushReviewState(userId: string, id: string, meta: SyncMeta): Promise<void> {
    const state = meta.deletedAt ? undefined : await db.meaningReviewStates.get(id);
    if (state) {
      const { error } = await this.supabaseClient
        .from('meaning_review_states')
        .upsert({ ...reviewStateToRemote(state), user_id: userId });
      if (error) throw error;
    } else if (meta.deletedAt) {
      await this.deleteRemote('meaning_review_states', userId, 'meaning_id', id);
    }
    await syncMetaRepository.markSynced(`review-state:${id}`, meta.updatedAt);
  }

  private async deleteRemote(
    table: string,
    userId: string,
    idColumn: string,
    id: string
  ): Promise<void> {
    const { error } = await this.supabaseClient
      .from(table)
      .delete()
      .eq('user_id', userId)
      .eq(idColumn, id);
    if (error) throw error;
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
    // Never let a remote row blank out the local-only review fields: they have no
    // cloud column, so a plain overwrite would destroy them on every pull.
    const merged = mergeAppendOnlyByIdPreservingLocal(localRecords, remoteRecords);
    for (const record of merged) {
      record.localOwnerUserId = userId;
      await db.reviewRecords.put(record);
    }
  }

  private async fetchWords(userId: string): Promise<CloudWord[]> {
    return this.fetchAll<CloudWord>('user_words', userId, 'updated_at');
  }

  private async fetchMeanings(userId: string): Promise<CloudMeaning[]> {
    return this.fetchAll<CloudMeaning>('user_meanings', userId, 'updated_at');
  }

  private async fetchReviewStates(userId: string): Promise<CloudReviewState[]> {
    return this.fetchAll<CloudReviewState>('meaning_review_states', userId, 'updated_at');
  }

  private async fetchReviewRecords(userId: string): Promise<ReviewRecord[]> {
    // review_records is append-only and has no updated_at column.
    const rows = await this.fetchAll<CloudReviewRecord>('review_records', userId, 'created_at');
    return rows.map(reviewRecordFromRemote);
  }

  // PostgREST truncates a response at the project's max-rows setting, which would
  // silently drop the remaining rows. Page through with a stable order instead.
  private async fetchAll<T>(table: string, userId: string, orderColumn: string): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += FETCH_PAGE_SIZE) {
      const { data, error } = await this.supabaseClient
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order(orderColumn, { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + FETCH_PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < FETCH_PAGE_SIZE) return rows;
    }
  }
}
