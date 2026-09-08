import { describe, expect, it } from 'vitest';
import type { Meaning } from '../../types';
import { resolveEnZhRatings } from './srsReviewService';

function meaning(id: string): Meaning {
  return {
    id,
    wordId: 'w1',
    partOfSpeech: 'v.',
    chineseMeaning: `释义${id}`,
    selectedForStudy: true,
    correctCount: 0,
    incorrectCount: 0,
    createdAt: 1,
    updatedAt: 1
  };
}

describe('英译中 FSRS 评分映射', () => {
  it('4 个 Meaning 答对 2 个时，两个 Good + 两个 Again', () => {
    const meanings = [meaning('a'), meaning('b'), meaning('c'), meaning('d')];
    const ratings = resolveEnZhRatings(meanings, ['a', 'c']);
    expect(ratings.filter((item) => item.rating === 'good')).toHaveLength(2);
    expect(ratings.filter((item) => item.rating === 'again')).toHaveLength(2);
    expect(ratings.find((item) => item.meaningId === 'a')?.rating).toBe('good');
    expect(ratings.find((item) => item.meaningId === 'b')?.rating).toBe('again');
  });
});
