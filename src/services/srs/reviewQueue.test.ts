import { describe, expect, it } from 'vitest';
import type { Meaning, MeaningReviewState } from '../../types';
import { buildReviewQueue, countQueueItems } from './reviewQueue';

const word = { id: 'w1', word: 'charge', createdAt: 1, updatedAt: 1 };

function meaning(id: string, selected = true): Meaning {
  return {
    id,
    wordId: 'w1',
    partOfSpeech: 'v.',
    chineseMeaning: `释义${id}`,
    selectedForStudy: selected,
    correctCount: 0,
    incorrectCount: 0,
    createdAt: 1,
    updatedAt: 1
  };
}

function state(
  meaningId: string,
  dueAt: number,
  reviewState: MeaningReviewState['state'] = 'review'
): MeaningReviewState {
  return {
    meaningId,
    state: reviewState,
    dueAt,
    reps: 1,
    lapses: 0,
    createdAt: 1,
    updatedAt: 1
  };
}

describe('review queue', () => {
  it('dueAt <= now 会进入今日复习', () => {
    const queue = buildReviewQueue([word], [meaning('m1')], [state('m1', 100)], {
      now: 200
    });
    expect(queue.map((item) => item.meaning.id)).toContain('m1');
  });

  it('dueAt > now 不进入今日复习', () => {
    const queue = buildReviewQueue([word], [meaning('m1')], [state('m1', 300)], {
      now: 200
    });
    expect(queue).toHaveLength(0);
  });

  it('selectedForStudy=false 不进入 queue', () => {
    const queue = buildReviewQueue(
      [word],
      [meaning('m1', false)],
      [state('m1', 100)],
      { now: 200 }
    );
    expect(queue).toHaveLength(0);
  });

  it('daily new limit 按 Meaning 数计算', () => {
    const meanings = [meaning('n1'), meaning('n2'), meaning('n3')];
    const queue = buildReviewQueue([word], meanings, [], {
      now: 200,
      dailyNewMeaningLimit: 2
    });
    expect(queue).toHaveLength(2);
  });

  it('逾期项优先于新义项', () => {
    const meanings = [meaning('new1'), meaning('due1')];
    const states = [state('due1', 1)];
    const queue = buildReviewQueue([word], meanings, states, {
      now: 200,
      dailyNewMeaningLimit: 1
    });
    expect(queue[0].meaning.id).toBe('due1');
  });

  it('countQueueItems 正确区分 due/new/overdue', () => {
    const meanings = [meaning('new1'), meaning('due1'), meaning('overdue1')];
    const states = [state('due1', 86_400_000), state('overdue1', 1)];
    const counts = countQueueItems([word], meanings, states, 86_400_100);
    expect(counts.new).toBe(1);
    expect(counts.due).toBe(2);
    expect(counts.overdue).toBe(1);
  });
});
