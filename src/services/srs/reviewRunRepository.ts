import { db } from '../../db/db';
import { createId } from '../../lib/id';
import type { ReviewRun, ReviewRunMode } from '../../core/reviewRun';
import { advanceChoiceRun } from '../../core/reviewRun';
import { getCurrentOwnerUserId } from '../ownership/ownership';
import { settingsRepository } from '../../repositories/settingsRepository';
import { buildReviewWordQueue } from './reviewQueue';

export function reviewRunKey(mode: ReviewRunMode, owner = getCurrentOwnerUserId()): string {
  return JSON.stringify([owner, mode]);
}

const loadingRuns = new Map<string, Promise<{ run: ReviewRun; resumed: boolean }>>();

export function loadReviewRun(mode: ReviewRunMode): Promise<{ run: ReviewRun; resumed: boolean }> {
  const key = reviewRunKey(mode);
  const existing = loadingRuns.get(key);
  if (existing) return existing;
  const pending = readOrCreateRun(mode).finally(() => loadingRuns.delete(key));
  loadingRuns.set(key, pending);
  return pending;
}

async function readOrCreateRun(mode: ReviewRunMode): Promise<{ run: ReviewRun; resumed: boolean }> {
  const owner = getCurrentOwnerUserId();
  const settings = await settingsRepository.get();
  return db.transaction('rw', [db.activeReviewRuns, db.words, db.meanings, db.meaningReviewStates], async () => {
    if (owner !== getCurrentOwnerUserId()) throw new Error('用户已切换');
    const [existing, words, meanings, states] = await Promise.all([
      db.activeReviewRuns.get(reviewRunKey(mode, owner)),
      db.words.filter((word) => (word.localOwnerUserId ?? null) === owner).toArray(),
      db.meanings.filter((meaning) => (meaning.localOwnerUserId ?? null) === owner && meaning.selectedForStudy).toArray(),
      db.meaningReviewStates.filter((state) => (state.localOwnerUserId ?? null) === owner).toArray()
    ]);
    if (existing?.status === 'active') {
      // Deleted/deselected content must not be resurrected by a saved queue.
      const remaining = existing.queue.slice(existing.index).flatMap((task) => {
        const word = words.find((word) => word.id === task.word.id);
        const currentMeanings = task.meanings.flatMap((meaning) => meanings.filter((current) => current.id === meaning.id && current.wordId === word?.id));
        if (!word || !currentMeanings.length) return [];
        const changed = word.word !== task.word.word || currentMeanings.length !== task.meanings.length ||
          currentMeanings.some((meaning, i) => meaning.chineseMeaning !== task.meanings[i]?.chineseMeaning || meaning.partOfSpeech !== task.meanings[i]?.partOfSpeech);
        return [{ ...task, word, meanings: currentMeanings, taskId: changed ? createId() : task.taskId }];
      });
      const run: ReviewRun = { ...existing,
        queue: [...existing.queue.slice(0, existing.index), ...remaining],
        status: remaining.length ? 'active' : 'finished', updatedAt: Date.now() };
      await db.activeReviewRuns.put(run);
      return { run, resumed: true };
    }
    const items = buildReviewWordQueue(words, meanings, states, { dailyNewMeaningLimit: settings.dailyNewMeaningLimit })
      .map((item) => ({ ...item, retry: 0, taskId: createId() }));
    const queue = [
      ...items.map(item => ({ ...item, phase: 'choice' as const })),
      ...items.map(item => ({ ...item, phase: 'input' as const, taskId: createId() }))
    ];
    const run: ReviewRun = {
      id: reviewRunKey(mode, owner), sessionId: createId(), localOwnerUserId: owner,
      mode, status: queue.length ? 'active' : 'finished', queue, index: 0,
      initialWordCount: items.length, completedWords: 0, completedMeanings: 0,
      completedRetries: 0, unresolvedMeaningIds: [], updatedAt: Date.now()
    };
    await db.activeReviewRuns.put(run);
    return { run, resumed: false };
  });
}

export async function saveChoiceProgress(run: ReviewRun, direction: 'en-zh' | 'zh-en'): Promise<ReviewRun> {
  return db.transaction('rw', db.activeReviewRuns, async () => {
    const saved = await db.activeReviewRuns.get(run.id);
    if (!saved || saved.sessionId !== run.sessionId || saved.localOwnerUserId !== getCurrentOwnerUserId()) throw new Error('复习会话已变化');
    const taskId = run.queue[run.index].taskId;
    if (saved.queue.slice(0, saved.index).some(task => task.taskId === taskId)) return saved;
    if (saved.status !== 'active' || saved.queue[saved.index]?.taskId !== taskId) throw new Error('题目已变化');
    const next = advanceChoiceRun(saved, direction);
    await db.activeReviewRuns.put(next);
    return next;
  });
}

export async function finishReviewRun(run: ReviewRun): Promise<ReviewRun> {
  return db.transaction('rw', db.activeReviewRuns, async () => {
    const saved = await db.activeReviewRuns.get(run.id);
    if (!saved || saved.localOwnerUserId !== getCurrentOwnerUserId() || saved.sessionId !== run.sessionId) throw new Error('复习会话已变化');
    const finished: ReviewRun = { ...saved, status: 'finished', updatedAt: Date.now() };
    await db.activeReviewRuns.put(finished);
    return finished;
  });
}
