import { describe, expect, it } from 'vitest';
import { normalizeWeaknesses, preferredWeaknessDirection, readWeaknesses } from './studySupport';
import { createEmptyReviewState, reviewMeaningWithFsrs } from '../services/srs/fsrsScheduler';
import { reviewStateFromRemote, reviewStateToRemote } from '../services/sync/supabaseMappers';

describe('optional study weaknesses', () => {
  it('keeps unmarked and old data on the original path', () => {
    expect(readWeaknesses()).toEqual([]);
    expect(readWeaknesses(createEmptyReviewState('m'))).toEqual([]);
    expect(preferredWeaknessDirection([])).toBeUndefined();
    expect(normalizeWeaknesses(['meaning', 'meaning', 'invalid'])).toEqual(['meaning']);
  });
  it('only directs adaptive review for an unambiguous manual mark', () => {
    expect(preferredWeaknessDirection(['meaning'])).toBe('en-to-zh');
    expect(preferredWeaknessDirection(['spelling'])).toBe('spelling');
    expect(preferredWeaknessDirection(['meaning', 'spelling'])).toBeUndefined();
  });
  it('preserves marks through scheduling and existing cloud payloads', () => {
    const state = { ...createEmptyReviewState('m', 1000), fsrsData: { studySupport: { weaknesses: ['confusion'] } } };
    const reviewed = reviewMeaningWithFsrs(state, 'm', 'good', .9, 2000).state;
    expect(readWeaknesses(reviewStateFromRemote(reviewStateToRemote(reviewed)))).toEqual(['confusion']);
    expect(reviewed.reps).toBe(1);
  });
});
