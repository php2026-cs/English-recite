import { describe, expect, it } from 'vitest';
import type { Meaning, MeaningReviewState } from '../../types';
import { buildReviewWordQueue } from './reviewQueue';

const word = { id: 'w1', word: 'charge', createdAt: 1, updatedAt: 1 };

function meaning(id: string, wordId = 'w1'): Meaning {
  return {
    id,
    wordId,
    partOfSpeech: 'v.',
    chineseMeaning: `释义${id}`,
    selectedForStudy: true,
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

describe('review word queue', () => {
  it('6 个 due Meaning 同属 charge → 只生成 1 个 Word review item', () => {
    const meanings = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => meaning(id));
    const states = meanings.map((m) => state(m.id, 100));
    const queue = buildReviewWordQueue([word], meanings, states, { now: 200 });
    expect(queue).toHaveLength(1);
    expect(queue[0].meanings).toHaveLength(6);
  });

  it('charge 3 个 due + 3 个未到期 → 本题只包含 3 个', () => {
    const meanings = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => meaning(id));
    const states = [
      ...['a', 'b', 'c'].map((id) => state(id, 100)),
      ...['d', 'e', 'f'].map((id) => state(id, 300))
    ];
    const queue = buildReviewWordQueue([word], meanings, states, { now: 200 });
    expect(queue[0].meanings.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('一个 Word 同一天只出现一次', () => {
    const meanings = ['a', 'b'].map((id) => meaning(id));
    const states = meanings.map((m) => state(m.id, 100));
    const queue = buildReviewWordQueue([word], meanings, states, { now: 200 });
    expect(queue).toHaveLength(1);
  });
});
