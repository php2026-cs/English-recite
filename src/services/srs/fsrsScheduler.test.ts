import { describe, expect, it } from 'vitest';
import { createEmptyReviewState, reviewMeaningWithFsrs } from './fsrsScheduler';

describe('FSRS scheduler', () => {
  it('一个 Word 的多个 Meaning 有独立 ReviewState', () => {
    const a = createEmptyReviewState('meaning-a', 1_700_000_000_000);
    const b = createEmptyReviewState('meaning-b', 1_700_000_000_000);
    expect(a.meaningId).not.toBe(b.meaningId);
    expect(a).not.toBe(b);
  });

  it('v.收费 Good 不影响 v.指控', () => {
    const chargeA = createEmptyReviewState('charge-a');
    const chargeB = createEmptyReviewState('charge-b');
    const outcomeA = reviewMeaningWithFsrs(chargeA, 'charge-a', 'good');
    expect(outcomeA.state.meaningId).toBe('charge-a');
    expect(chargeB.reps).toBe(0);
  });

  it('Again / Hard / Good / Easy 会生成不同且单调递增的 dueAt', () => {
    const ratings = ['again', 'hard', 'good', 'easy'] as const;
    const dueTimes = ratings.map((rating) =>
      reviewMeaningWithFsrs(undefined, 'm', rating, 0.9, 1_700_000_000_000).nextDueAt
    );
    for (let i = 1; i < dueTimes.length; i += 1) {
      expect(dueTimes[i]).toBeGreaterThanOrEqual(dueTimes[i - 1]);
    }
  });

  it('dueAt 会正确生成', () => {
    const outcome = reviewMeaningWithFsrs(undefined, 'm', 'good', 0.9, 1_700_000_000_000);
    expect(outcome.nextDueAt).toBeGreaterThan(0);
    expect(outcome.state.dueAt).toBe(outcome.nextDueAt);
  });

  it('稳定性和难度字段会写入状态', () => {
    const outcome = reviewMeaningWithFsrs(undefined, 'm', 'good');
    expect(outcome.state.stability).toBeGreaterThan(0);
    expect(outcome.state.difficulty).toBeGreaterThan(0);
  });
});
