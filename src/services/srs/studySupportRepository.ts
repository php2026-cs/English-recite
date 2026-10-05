import { db } from '../../db/db';
import { normalizeWeaknesses, type StudyWeakness } from '../../core/studySupport';
import { reviewStateRepository } from './reviewState';
import { syncMetaRepository } from '../sync/syncMetaRepository';

export async function saveStudyWeaknesses(meaningId: string, weaknesses: StudyWeakness[]) {
  const state = await reviewStateRepository.getOrCreate(meaningId);
  const updatedAt = Date.now();
  const previous = state.fsrsData?.studySupport;
  await db.meaningReviewStates.put({ ...state, updatedAt, fsrsData: {
    ...state.fsrsData,
    studySupport: { ...(typeof previous === 'object' && previous ? previous : {}), weaknesses: normalizeWeaknesses(weaknesses) }
  }});
  await syncMetaRepository.markDirty(`review-state:${meaningId}`, updatedAt);
}
