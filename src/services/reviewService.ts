import { db } from '../db/db';
import { createId } from '../lib/id';
import type { Meaning, ReviewRecord, ReviewSession, Word } from '../types';

export async function recordZhEnResult(
  word: Word,
  meaning: Meaning,
  correct: boolean
): Promise<void> {
  const reviewedAt = Date.now();
  const record: ReviewRecord = {
    id: createId(),
    wordId: word.id,
    meaningId: meaning.id,
    mode: 'zh-to-en',
    correct,
    reviewedAt
  };

  await db.transaction('rw', db.reviewRecords, db.meanings, async () => {
    await db.reviewRecords.add(record);
    const current = await db.meanings.get(meaning.id);
    if (!current) return;
    await db.meanings.update(meaning.id, {
      correctCount: current.correctCount + (correct ? 1 : 0),
      incorrectCount: current.incorrectCount + (correct ? 0 : 1),
      lastReviewedAt: reviewedAt
    });
  });
}

export async function recordEnZhSession(
  word: Word,
  meanings: Meaning[],
  completedIds: string[],
  revealedIds: string[]
): Promise<void> {
  const reviewedAt = Date.now();
  const session: ReviewSession = {
    id: createId(),
    wordId: word.id,
    mode: 'en-to-zh',
    totalMeanings: meanings.length,
    recalledMeaningIds: completedIds,
    revealedMeaningIds: revealedIds,
    createdAt: reviewedAt
  };

  await db.transaction('rw', db.reviewSessions, db.reviewRecords, db.meanings, async () => {
    await db.reviewSessions.add(session);
    for (const meaning of meanings) {
      const correct = completedIds.includes(meaning.id);
      await db.reviewRecords.add({
        id: createId(),
        wordId: word.id,
        meaningId: meaning.id,
        mode: 'en-to-zh',
        correct,
        reviewedAt
      });
      const current = await db.meanings.get(meaning.id);
      if (!current) continue;
      await db.meanings.update(meaning.id, {
        correctCount: current.correctCount + (correct ? 1 : 0),
        incorrectCount: current.incorrectCount + (correct ? 0 : 1),
        lastReviewedAt: reviewedAt
      });
    }
  });
}
