import { db } from '../../db/db';
import { createId } from '../../lib/id';
import type {
  Meaning,
  MeaningReviewState,
  ReviewErrorType,
  ReviewQuestionType,
  ReviewRating,
  Word
} from '../../types';
import { settingsRepository } from '../../repositories/settingsRepository';
import { reviewMeaningWithFsrs } from './fsrsScheduler';
import {
  calculateDifficulty,
  updatePerformanceProfile
} from '../personalization/personalizationEngine';
import { getCurrentOwnerUserId } from '../ownership/ownership';
import { advanceReviewRun, type ReviewRun } from '../../core/reviewRun';

interface ReviewContext {
  word: Word;
  meaning: Meaning;
  rating: ReviewRating;
  mode: 'zh-to-en' | 'en-to-zh';
  questionType: ReviewQuestionType;
  reviewedAt: number;
  desiredRetention: number;
  responseTimeMs?: number;
  confidence?: number;
  inputValue?: string;
  errorType?: ReviewErrorType;
}

export function resolveEnZhRatings(
  meanings: Meaning[],
  recalledMeaningIds: string[]
): Array<{ meaningId: string; rating: ReviewRating }> {
  const recalledSet = new Set(recalledMeaningIds);
  return meanings.map((meaning) => ({
    meaningId: meaning.id,
    rating: recalledSet.has(meaning.id) ? 'good' : 'again'
  }));
}

async function applyMeaningReview({
  word,
  meaning,
  rating,
  mode,
  questionType,
  reviewedAt,
  desiredRetention,
  responseTimeMs,
  confidence,
  inputValue,
  errorType
}: ReviewContext): Promise<void> {
  let previousState = await db.meaningReviewStates.get(meaning.id);
  if (previousState && (previousState.localOwnerUserId ?? null) !== getCurrentOwnerUserId()) {
    previousState = undefined;
  }
  const outcome = reviewMeaningWithFsrs(
    previousState,
    meaning.id,
    rating,
    desiredRetention,
    reviewedAt
  );

  await db.meaningReviewStates.put(outcome.state);
  const recordId = createId();
  await db.reviewRecords.add({
    id: recordId,
    wordId: word.id,
    meaningId: meaning.id,
    mode,
    correct: rating !== 'again',
    result: rating,
    questionType,
    responseTimeMs,
    confidence,
    inputValue,
    errorType,
    localOwnerUserId: getCurrentOwnerUserId(),
    previousDueAt: previousState?.dueAt,
    nextDueAt: outcome.nextDueAt,
    reviewedAt
  });
  await markSyncMetaDirty(`review-state:${meaning.id}`, reviewedAt);
  await markSyncMetaDirty(`review:${recordId}`, reviewedAt);

  const current = await db.meanings.get(meaning.id);
  if (current) {
    await db.meanings.update(meaning.id, {
      correctCount: current.correctCount + (rating !== 'again' ? 1 : 0),
      incorrectCount: current.incorrectCount + (rating === 'again' ? 1 : 0),
      lastReviewedAt: reviewedAt
    });
  }

  const previousProfile = await db.performanceProfiles.get(meaning.id);
  const nextProfile = updatePerformanceProfile(previousProfile, {
    meaningId: meaning.id,
    questionType,
    correct: rating !== 'again',
    fsrsDifficulty: outcome.difficulty,
    lapses: outcome.lapses,
    responseTimeMs,
    confidence,
    reviewedAt
  });
  await db.performanceProfiles.put(nextProfile);
  await db.meaningDifficulties.put(
    calculateDifficulty(nextProfile, outcome.state, outcome.difficulty)
  );
}

async function markSyncMetaDirty(
  entityKey: string,
  updatedAt: number
): Promise<void> {
  const existing = await db.syncMeta.get(entityKey);
  await db.syncMeta.put({
    entityKey,
    syncStatus: 'dirty',
    deletedAt: existing?.deletedAt,
    updatedAt: Math.max(existing?.updatedAt ?? 0, updatedAt)
  });
}

export async function submitZhEnReview(input: {
  word: Word;
  meaning: Meaning;
  rating: ReviewRating;
  questionType?: ReviewQuestionType;
  mode?: 'zh-to-en' | 'en-to-zh';
  responseTimeMs?: number;
  confidence?: number;
  inputValue?: string;
  errorType?: ReviewErrorType;
}): Promise<void> {
  const reviewedAt = Date.now();
  const settings = await settingsRepository.get();
  await db.transaction(
    'rw',
    [
      db.meaningReviewStates,
      db.reviewRecords,
      db.meanings,
      db.syncMeta,
      db.performanceProfiles,
      db.meaningDifficulties
    ],
    async () => {
      await applyMeaningReview({
        word: input.word,
        meaning: input.meaning,
        rating: input.rating,
        mode: input.mode ?? 'zh-to-en',
        questionType: input.questionType ?? 'zh-to-en',
        reviewedAt,
        desiredRetention: settings.desiredRetention,
        responseTimeMs: input.responseTimeMs,
        confidence: input.confidence,
        inputValue: input.inputValue,
        errorType: input.errorType
      });
    }
  );
}

export async function submitZhEnReviewBatch(input: {
  word: Word;
  meanings: Meaning[];
  rating: ReviewRating;
  responseTimeMs?: number;
  confidence?: number;
  inputValue?: string;
  errorType?: ReviewErrorType;
}): Promise<void> {
  const reviewedAt = Date.now();
  const settings = await settingsRepository.get();
  await db.transaction(
    'rw',
    [
      db.meaningReviewStates,
      db.reviewRecords,
      db.meanings,
      db.syncMeta,
      db.performanceProfiles,
      db.meaningDifficulties
    ],
    async () => {
      for (const meaning of input.meanings) {
        await applyMeaningReview({
          word: input.word,
          meaning,
          rating: input.rating,
          mode: 'zh-to-en',
          questionType: 'zh-to-en',
          reviewedAt,
          desiredRetention: settings.desiredRetention,
          responseTimeMs: input.responseTimeMs,
          confidence: input.confidence,
          inputValue: input.inputValue,
          errorType: input.errorType
        });
      }
    }
  );
}

export async function submitAdaptiveWordReview(input: {
  word: Word;
  questionType: ReviewQuestionType;
  results: Array<{
    meaning: Meaning;
    rating: ReviewRating;
    confidence?: number;
    inputValue: string;
  }>;
  responseTimeMs: number;
  recordEnZhSession?: boolean;
  reviewRun?: { id: string; sessionId: string; taskId: string };
}): Promise<ReviewRun | undefined> {
  const ownerId = getCurrentOwnerUserId();
  if ((input.word.localOwnerUserId ?? null) !== ownerId ||
      input.results.length === 0 ||
      new Set(input.results.map((item) => item.meaning.id)).size !== input.results.length ||
      input.results.some(({ meaning }) => meaning.wordId !== input.word.id ||
        (meaning.localOwnerUserId ?? null) !== ownerId)) {
    throw new Error('复习数据与当前用户或单词不一致');
  }
  const settings = await settingsRepository.get();
  const reviewedAt = Date.now();
  return db.transaction('rw', [db.words, db.meaningReviewStates, db.reviewRecords,
    db.meanings, db.syncMeta, db.performanceProfiles, db.meaningDifficulties, db.reviewSessions, db.activeReviewRuns], async () => {
    if (getCurrentOwnerUserId() !== ownerId) throw new Error('用户已切换，请重新开始复习');
    let run: ReviewRun | undefined;
    if (input.reviewRun) {
      run = await db.activeReviewRuns.get(input.reviewRun.id);
      if (!run || run.sessionId !== input.reviewRun.sessionId || run.localOwnerUserId !== ownerId) throw new Error('复习会话已变化');
      // A second tab or a retried request may reference a question already committed.
      if (run.queue.slice(0, run.index).some((item) => item.taskId === input.reviewRun!.taskId)) return run;
      const task = run.queue[run.index];
      if (run.status !== 'active' || task?.taskId !== input.reviewRun.taskId ||
        task.meanings.length !== input.results.length ||
        task.meanings.some((meaning) => !input.results.some((result) => result.meaning.id === meaning.id))) {
        throw new Error('当前题目已变化，请重新进入复习');
      }
    }
    const storedWord = await db.words.get(input.word.id);
    if (!storedWord || storedWord.word !== input.word.word || (storedWord.localOwnerUserId ?? null) !== ownerId) {
      throw new Error('单词已删除或用户已切换');
    }
    for (const item of input.results) {
      const stored = await db.meanings.get(item.meaning.id);
      if (!stored || !stored.selectedForStudy || stored.wordId !== input.word.id ||
          stored.chineseMeaning !== item.meaning.chineseMeaning || stored.partOfSpeech !== item.meaning.partOfSpeech ||
          (stored.localOwnerUserId ?? null) !== ownerId) {
        throw new Error('义项已变更，请重新开始复习');
      }
      await applyMeaningReview({
        word: input.word, meaning: stored, rating: item.rating,
        mode: input.questionType === 'en-to-zh' ? 'en-to-zh' : 'zh-to-en',
        questionType: input.questionType, reviewedAt,
        desiredRetention: settings.desiredRetention,
        responseTimeMs: input.responseTimeMs, confidence: item.confidence,
        inputValue: item.inputValue,
        errorType: item.rating !== 'again' ? undefined : input.questionType === 'en-to-zh'
          ? 'wrong_meaning' : input.questionType === 'spelling' ? 'spelling_error' : 'unknown'
      });
    }
    if (input.recordEnZhSession && input.questionType === 'en-to-zh') {
      await db.reviewSessions.add({
        id: createId(), wordId: input.word.id, mode: 'en-to-zh',
        totalMeanings: input.results.length,
        recalledMeaningIds: input.results.filter((item) => item.rating !== 'again').map((item) => item.meaning.id),
        revealedMeaningIds: input.results.map((item) => item.meaning.id),
        createdAt: reviewedAt, localOwnerUserId: ownerId
      });
    }
    if (getCurrentOwnerUserId() !== ownerId) throw new Error('用户已切换，请重新开始复习');
    if (run) {
      const next = advanceReviewRun(run, input.results, createId(), reviewedAt);
      await db.activeReviewRuns.put(next);
      return next;
    }
  });
}

export async function submitEnZhReview(input: {
  word: Word;
  meanings: Meaning[];
  recalledMeaningIds: string[];
  revealedMeaningIds: string[];
}): Promise<void> {
  const reviewedAt = Date.now();
  const settings = await settingsRepository.get();
  await db.transaction(
    'rw',
    [
      db.meaningReviewStates,
      db.reviewRecords,
      db.reviewSessions,
      db.meanings,
      db.syncMeta,
      db.performanceProfiles,
      db.meaningDifficulties
    ],
    async () => {
      const ratings = resolveEnZhRatings(input.meanings, input.recalledMeaningIds);
      for (const meaning of input.meanings) {
        const rating = ratings.find((item) => item.meaningId === meaning.id)?.rating ?? 'again';
        await applyMeaningReview({
          word: input.word,
          meaning,
          rating,
          mode: 'en-to-zh',
          questionType: 'en-to-zh',
          reviewedAt,
          desiredRetention: settings.desiredRetention
        });
      }

      await db.reviewSessions.add({
        id: createId(),
        wordId: input.word.id,
        mode: 'en-to-zh',
        totalMeanings: input.meanings.length,
        recalledMeaningIds: input.recalledMeaningIds,
        revealedMeaningIds: input.revealedMeaningIds,
        createdAt: reviewedAt
      });
    }
  );
}

export async function getReviewStateMap(): Promise<Map<string, MeaningReviewState>> {
  const states = await db.meaningReviewStates.toArray();
  return new Map(states.map((state) => [state.meaningId, state]));
}
