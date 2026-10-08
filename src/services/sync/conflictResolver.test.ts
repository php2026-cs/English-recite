import { describe, expect, it } from 'vitest';
import type { MeaningReviewState, ReviewRecord } from '../../types';
import {
  mergeAppendOnlyById,
  mergeAppendOnlyByIdPreservingLocal,
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

describe('ReviewRecord 合并保留本地专有字段', () => {
  const local: ReviewRecord = {
    id: 'r1', wordId: 'w1', meaningId: 'm1', mode: 'en-to-zh', correct: true,
    result: 'hard', questionType: 'en-to-zh', errorType: 'wrong_meaning',
    confidence: 2, inputValue: '收费', hintUsed: true, responseTimeMs: 4000,
    reviewedAt: 100, localOwnerUserId: 'user-1'
  };
  // reviewRecordFromRemote() only produces the columns that exist in the cloud.
  const remote: ReviewRecord = {
    id: 'r1', wordId: 'w1', meaningId: 'm1', mode: 'en-to-zh', correct: true,
    result: 'hard', previousDueAt: undefined, nextDueAt: 200,
    responseTimeMs: undefined, reviewedAt: 100
  };

  it('云端缺失的字段不会被抹掉', () => {
    const [merged] = mergeAppendOnlyByIdPreservingLocal([local], [remote]);
    expect(merged.questionType).toBe('en-to-zh');
    expect(merged.errorType).toBe('wrong_meaning');
    expect(merged.confidence).toBe(2);
    expect(merged.inputValue).toBe('收费');
    expect(merged.hintUsed).toBe(true);
    expect(merged.localOwnerUserId).toBe('user-1');
    expect(merged.responseTimeMs).toBe(4000);
  });

  it('云端存在的字段仍然生效', () => {
    const [merged] = mergeAppendOnlyByIdPreservingLocal([local], [remote]);
    expect(merged.nextDueAt).toBe(200);
  });

  it('只存在于云端的记录会被加入，本地独有的记录不会丢失', () => {
    const extra: ReviewRecord = { ...remote, id: 'r2' };
    const merged = mergeAppendOnlyByIdPreservingLocal([local], [remote, extra]);
    expect(merged.map((record) => record.id).sort()).toEqual(['r1', 'r2']);
  });

  it('旧的直接覆盖式合并会丢字段，因此不能再用于 ReviewRecord', () => {
    const [overwritten] = mergeAppendOnlyById([local], [remote]);
    expect(overwritten.hintUsed).toBeUndefined();
    expect(overwritten.questionType).toBeUndefined();
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
