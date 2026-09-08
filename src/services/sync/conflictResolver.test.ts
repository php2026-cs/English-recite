import { describe, expect, it } from 'vitest';
import type { MeaningReviewState } from '../../types';
import {
  mergeAppendOnlyById,
  resolveLastWriteWins,
  resolveMeaningReviewState
} from './conflictResolver';

describe('sync conflict resolver', () => {
  it('newer local 覆盖 older remote', () => {
    const result = resolveLastWriteWins(
      { id: 'w1', updatedAt: 200 },
      { id: 'w1', updatedAt: 100 }
    );
    expect(result.updatedAt).toBe(200);
  });

  it('newer remote 覆盖 older local', () => {
    const result = resolveLastWriteWins(
      { id: 'w1', updatedAt: 100 },
      { id: 'w1', updatedAt: 300 }
    );
    expect(result.updatedAt).toBe(300);
  });

  it('ReviewRecord append-only merge，重复 id 不重复插入', () => {
    const local = [{ id: 'r1' }, { id: 'r2' }];
    const remote = [{ id: 'r2' }, { id: 'r3' }];
    expect(mergeAppendOnlyById(local, remote)).toHaveLength(3);
  });

  it('MeaningReviewState 优先 lastReviewAt 更新的状态', () => {
    const local = state('m1', 100, 100);
    const remote = state('m1', 200, 200);
    expect(resolveMeaningReviewState(local, remote)).toBe(remote);
  });

  it('lastReviewAt 相同时使用 updatedAt', () => {
    const local = state('m1', 100, 200);
    const remote = state('m1', 100, 100);
    expect(resolveMeaningReviewState(local, remote)).toBe(local);
  });
});

function state(
  meaningId: string,
  lastReviewAt: number,
  updatedAt: number
): MeaningReviewState {
  return {
    meaningId,
    state: 'review',
    dueAt: 1,
    lastReviewAt,
    reps: 1,
    lapses: 0,
    updatedAt,
    createdAt: 1
  };
}
