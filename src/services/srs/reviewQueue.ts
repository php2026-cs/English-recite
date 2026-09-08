import type { Meaning, MeaningReviewState, Word } from '../../types';

export interface ReviewQueueItem {
  wordId: string;
  word: string;
  meaning: Meaning;
  reviewState: MeaningReviewState | undefined;
  overdueDays: number;
}

export interface ReviewWordItem {
  word: Word;
  meanings: Meaning[];
  overdueDays: number;
}

export function buildReviewQueue(
  words: Word[],
  meanings: Meaning[],
  reviewStates: MeaningReviewState[],
  options: {
    now?: number;
    dailyNewMeaningLimit?: number;
  } = {}
): ReviewQueueItem[] {
  const nowMs = options.now ?? Date.now();
  const dailyNewLimit = options.dailyNewMeaningLimit ?? 20;
  const stateByMeaning = new Map(
    reviewStates.map((state) => [state.meaningId, state])
  );
  const wordByMeaning = new Map(
    meanings.map((meaning) => [
      meaning.id,
      words.find((word) => word.id === meaning.wordId)?.word ?? ''
    ])
  );
  const selected = meanings.filter((meaning) => meaning.selectedForStudy);

  const newItems: ReviewQueueItem[] = [];
  const dueItems: ReviewQueueItem[] = [];

  for (const meaning of selected) {
    const reviewState = stateByMeaning.get(meaning.id);
    const due = reviewState?.dueAt ?? 0;
    if (!reviewState || reviewState.state === 'new') {
      newItems.push({
        wordId: meaning.wordId,
        word: wordByMeaning.get(meaning.id) ?? '',
        meaning,
        reviewState,
        overdueDays: 0
      });
    } else if (due <= nowMs) {
      dueItems.push({
        wordId: meaning.wordId,
        word: wordByMeaning.get(meaning.id) ?? '',
        meaning,
        reviewState,
        overdueDays: Math.floor((nowMs - due) / 86_400_000)
      });
    }
  }

  dueItems.sort((a, b) => b.overdueDays - a.overdueDays);
  const limitedNewItems = newItems.slice(0, dailyNewLimit);

  return [...dueItems, ...limitedNewItems];
}

export function countQueueItems(
  words: Word[],
  meanings: Meaning[],
  reviewStates: MeaningReviewState[],
  now = Date.now()
): { due: number; new: number; total: number; overdue: number } {
  const queue = buildReviewQueue(words, meanings, reviewStates, {
    now,
    dailyNewMeaningLimit: Infinity
  });
  return {
    due: queue.filter((item) => item.reviewState && item.reviewState.state !== 'new').length,
    new: queue.filter((item) => !item.reviewState || item.reviewState.state === 'new').length,
    total: queue.length,
    overdue: queue.filter((item) => item.overdueDays > 0).length
  };
}

export function buildReviewWordQueue(
  words: Word[],
  meanings: Meaning[],
  reviewStates: MeaningReviewState[],
  options: {
    now?: number;
    dailyNewMeaningLimit?: number;
  } = {}
): ReviewWordItem[] {
  const nowMs = options.now ?? Date.now();
  const dailyNewLimit = options.dailyNewMeaningLimit ?? 20;
  const stateByMeaning = new Map(
    reviewStates.map((state) => [state.meaningId, state])
  );
  const wordById = new Map(words.map((word) => [word.id, word]));
  const selected = meanings.filter((meaning) => meaning.selectedForStudy);

  const dueMeanings: Meaning[] = [];
  const newMeanings: Meaning[] = [];

  for (const meaning of selected) {
    const state = stateByMeaning.get(meaning.id);
    if (!state || state.state === 'new') {
      newMeanings.push(meaning);
    } else if (state.dueAt <= nowMs) {
      dueMeanings.push(meaning);
    }
  }

  dueMeanings.sort((a, b) => {
    const aState = stateByMeaning.get(a.id);
    const bState = stateByMeaning.get(b.id);
    return (aState?.dueAt ?? 0) - (bState?.dueAt ?? 0);
  });

  const limitedNewMeanings = newMeanings.slice(0, dailyNewLimit);
  const eligible = [...dueMeanings, ...limitedNewMeanings];
  const groups = new Map<string, Meaning[]>();
  const groupOrder: string[] = [];

  for (const meaning of eligible) {
    const current = groups.get(meaning.wordId);
    if (!current) {
      groups.set(meaning.wordId, [meaning]);
      groupOrder.push(meaning.wordId);
    } else {
      current.push(meaning);
    }
  }

  return groupOrder
    .map((wordId) => {
      const word = wordById.get(wordId);
      if (!word) return null;
      const groupMeanings = groups.get(wordId) ?? [];
      const overdueDays = groupMeanings.reduce((max, meaning) => {
        const state = stateByMeaning.get(meaning.id);
        if (!state || state.state === 'new') return max;
        return Math.max(max, Math.floor((nowMs - state.dueAt) / 86_400_000));
      }, 0);
      return { word, meanings: groupMeanings, overdueDays };
    })
    .filter((item): item is ReviewWordItem => item !== null);
}

export function countReviewWordQueue(
  words: Word[],
  meanings: Meaning[],
  reviewStates: MeaningReviewState[],
  options: {
    now?: number;
    dailyNewMeaningLimit?: number;
  } = {}
): { wordCount: number; meaningCount: number } {
  const items = buildReviewWordQueue(words, meanings, reviewStates, options);
  return {
    wordCount: items.length,
    meaningCount: items.reduce((sum, item) => sum + item.meanings.length, 0)
  };
}
