import type { Meaning, ReviewMode, Word } from '../types';
import {
  buildShuffledEnZhQueue,
  buildShuffledZhEnQueue,
  type EnZhItem,
  type ZhEnItem
} from './review';

export type ReviewItem = ZhEnItem | EnZhItem;

export function getNextReviewItem(
  mode: ReviewMode,
  words: Word[],
  meanings: Meaning[]
): ReviewItem | undefined {
  const selectedMeanings = meanings.filter((meaning) => meaning.selectedForStudy);
  if (selectedMeanings.length === 0) return undefined;

  if (mode === 'zh-to-en') {
    const queue = buildShuffledZhEnQueue(words, selectedMeanings);
    return queue[0];
  }

  const queue = buildShuffledEnZhQueue(words, selectedMeanings);
  return queue[0];
}
