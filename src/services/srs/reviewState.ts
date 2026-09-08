import { db } from '../../db/db';
import { now } from '../../lib/id';
import type { MeaningReviewState } from '../../types';
import { createEmptyReviewState } from './fsrsScheduler';
import { getCurrentOwnerUserId } from '../ownership/ownership';

export const reviewStateRepository = {
  async get(meaningId: string): Promise<MeaningReviewState | undefined> {
    const state = await db.meaningReviewStates.get(meaningId);
    return state && (state.localOwnerUserId ?? null) === getCurrentOwnerUserId()
      ? state
      : undefined;
  },

  async getOrCreate(meaningId: string): Promise<MeaningReviewState> {
    const existing = await db.meaningReviewStates.get(meaningId);
    if (existing && (existing.localOwnerUserId ?? null) === getCurrentOwnerUserId()) {
      return existing;
    }
    const created = createEmptyReviewState(meaningId);
    await db.meaningReviewStates.put(created);
    return created;
  },

  async save(state: MeaningReviewState): Promise<void> {
    await db.meaningReviewStates.put({
      ...state,
      updatedAt: now()
    });
  },

  async list(): Promise<MeaningReviewState[]> {
    return db.meaningReviewStates
      .filter((state) => (state.localOwnerUserId ?? null) === getCurrentOwnerUserId())
      .toArray();
  },

  async listDue(nowMs = Date.now()): Promise<MeaningReviewState[]> {
    return db.meaningReviewStates
      .where('dueAt')
      .belowOrEqual(nowMs)
      .filter((state) => (state.localOwnerUserId ?? null) === getCurrentOwnerUserId())
      .toArray();
  }
};
