import type { ReviewWordItem } from '../services/srs/reviewQueue';
import type { Meaning, ReviewRating } from '../types';

export type ReviewRunMode = 'en-zh' | 'zh-en' | 'adaptive';
export interface ReviewRunItem extends ReviewWordItem {
  taskId: string;
  retry: number;
  phase?: 'choice' | 'input';
  direction?: 'en-zh' | 'zh-en';
}
export interface ReviewRun {
  id: string;
  sessionId: string;
  localOwnerUserId: string | null;
  mode: ReviewRunMode;
  status: 'active' | 'finished';
  queue: ReviewRunItem[];
  index: number;
  initialWordCount: number;
  completedWords: number;
  completedMeanings: number;
  completedRetries: number;
  unresolvedMeaningIds: string[];
  updatedAt: number;
}
export const RETRY_GAP = 3;
export const MAX_RETRIES = 2;

export function advanceChoiceRun(run: ReviewRun, direction: 'en-zh' | 'zh-en'): ReviewRun {
  const current = run.queue[run.index];
  if (current.phase !== 'choice') throw new Error('当前不是选择轮');
  const index = run.index + 1;
  return { ...run, index, updatedAt: Date.now(),
    queue: run.queue.map(task => task.word.id === current.word.id ? { ...task, direction } : task),
    status: index < run.queue.length ? 'active' : 'finished' };
}

export function advanceReviewRun(run: ReviewRun,
  results: Array<{ meaning: Meaning; rating: ReviewRating }>, retryTaskId: string,
  now = Date.now()): ReviewRun {
  const current = run.queue[run.index];
  const forgotten = results.filter((result) => result.rating === 'again').map((result) => result.meaning);
  const unresolved = new Set(run.unresolvedMeaningIds);
  for (const result of results) {
    if (result.rating === 'again') unresolved.add(result.meaning.id);
    else unresolved.delete(result.meaning.id);
  }
  const queue = [...run.queue];
  if (forgotten.length && current.retry < MAX_RETRIES) {
    queue.splice(Math.min(run.index + 1 + RETRY_GAP, queue.length), 0, {
      ...current, meanings: forgotten, retry: current.retry + 1, taskId: retryTaskId
    });
  }
  const index = run.index + 1;
  return {
    ...run, queue, index, status: index < queue.length ? 'active' : 'finished',
    completedWords: run.completedWords + (current.retry === 0 ? 1 : 0),
    completedMeanings: run.completedMeanings + (current.retry === 0 ? results.length : 0),
    completedRetries: run.completedRetries + (current.retry > 0 ? 1 : 0),
    unresolvedMeaningIds: [...unresolved], updatedAt: now
  };
}
