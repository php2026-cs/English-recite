import { db } from '../db/db';
import { createId } from '../lib/id';
import { getCurrentOwnerUserId } from '../services/ownership/ownership';
import type { ReviewRecord, ReviewSession } from '../types';

export interface ReviewSummary {
  totalReviews: number;
  correctCount: number;
  incorrectCount: number;
  reviewedMeaningCount: number;
}

export interface TodayReviewSummary {
  total: number;
  correct: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export const reviewRepository = {
  async addRecord(
    input: Omit<ReviewRecord, 'id' | 'reviewedAt'>
  ): Promise<ReviewRecord> {
    const record: ReviewRecord = {
      ...input,
      id: createId(),
      reviewedAt: Date.now()
    };
    await db.reviewRecords.add(record);
    return record;
  },

  async addSession(input: Omit<ReviewSession, 'id' | 'createdAt'>): Promise<ReviewSession> {
    const session: ReviewSession = {
      ...input,
      id: createId(),
      createdAt: Date.now()
    };
    await db.reviewSessions.add(session);
    return session;
  },

  async listByMeaning(meaningId: string): Promise<ReviewRecord[]> {
    const owner = getCurrentOwnerUserId();
    return db.reviewRecords
      .where('meaningId')
      .equals(meaningId)
      .filter((record) => (record.localOwnerUserId ?? null) === owner)
      .toArray();
  },

  async getSummary(): Promise<ReviewSummary> {
    const owner = getCurrentOwnerUserId();
    const [records, reviewedMeaningIds] = await Promise.all([
      db.reviewRecords
        .filter((record) => (record.localOwnerUserId ?? null) === owner)
        .toArray(),
      db.meanings
        .filter(
          (meaning) =>
            (meaning.correctCount + meaning.incorrectCount) > 0 &&
            (meaning.localOwnerUserId ?? null) === owner
        )
        .toArray()
    ]);
    return {
      totalReviews: records.length,
      correctCount: records.filter((record) => record.correct).length,
      incorrectCount: records.filter((record) => !record.correct).length,
      reviewedMeaningCount: reviewedMeaningIds.length
    };
  },

  async getTodaySummary(nowMs = Date.now()): Promise<TodayReviewSummary> {
    const startOfDay = new Date(nowMs);
    startOfDay.setHours(0, 0, 0, 0);
    const owner = getCurrentOwnerUserId();
    const records = await db.reviewRecords
      .where('reviewedAt')
      .aboveOrEqual(startOfDay.getTime())
      .filter((record) => (record.localOwnerUserId ?? null) === owner)
      .toArray();
    return {
      total: records.length,
      correct: records.filter((record) => record.correct).length,
      again: records.filter((record) => record.result === 'again').length,
      hard: records.filter((record) => record.result === 'hard').length,
      good: records.filter((record) => record.result === 'good').length,
      easy: records.filter((record) => record.result === 'easy').length
    };
  }
};
