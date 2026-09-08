import { useEffect, useRef, useState } from 'react';
import type { ReviewRun } from '../../core/reviewRun';
import type { ReviewQuestion } from '../../core/adaptiveReview';
import type { ReviewRating } from '../../types';

export interface ReviewDraft {
  version: 1;
  question?: ReviewQuestion;
  answers: Record<string, string>;
  revealed: boolean;
  ratings: Record<string, ReviewRating>;
  confidence: Record<string, number>;
  elapsedMs: number;
}

export function reviewDraftKey(run: ReviewRun): string {
  return `lightwords:review-draft:${run.sessionId}:${run.queue[run.index]?.taskId}`;
}

export function readReviewDraft(run: ReviewRun): ReviewDraft | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(reviewDraftKey(run)) ?? 'null') as ReviewDraft | null;
    if (value?.version !== 1 || !value.answers || !value.ratings || !value.confidence ||
      !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 || typeof value.revealed !== 'boolean') return undefined;
    if (Object.values(value.answers).some((answer) => typeof answer !== 'string') ||
      Object.values(value.ratings).some((rating) => !['again', 'hard', 'good', 'easy'].includes(rating)) ||
      Object.values(value.confidence).some((score) => !Number.isFinite(score) || score < 0 || score > 3)) return undefined;
    const current = run.queue[run.index];
    if (value.revealed && current.meanings.some((meaning) => !value.ratings[meaning.id])) return undefined;
    if (value.question && (value.question.wordId !== current.word.id ||
      !['en-to-zh', 'zh-to-en', 'spelling'].includes(value.question.questionType))) return undefined;
    return value;
  } catch { return undefined; }
}

export function discardReviewDraft(run: ReviewRun): void {
  try { localStorage.removeItem(reviewDraftKey(run)); } catch { /* Progress is committed in IndexedDB. */ }
}

// Synchronous small drafts survive immediate refresh/pagehide; the actual review
// records and queue cursor are committed together in IndexedDB, never here.
export function useReviewDraft(run: ReviewRun, draft: Omit<ReviewDraft, 'version' | 'elapsedMs'>,
  getElapsed: () => number, enabled = true) {
  const [failed, setFailed] = useState(false);
  const latest = useRef({ draft, getElapsed, enabled });
  latest.current = { draft, getElapsed, enabled };
  const stopped = useRef(false);
  const key = reviewDraftKey(run);
  function persist() {
    if (stopped.current || !latest.current.enabled) return;
    try {
      localStorage.setItem(key, JSON.stringify({ ...latest.current.draft, version: 1, elapsedMs: latest.current.getElapsed() }));
      setFailed(false);
    } catch { setFailed(true); }
  }
  useEffect(() => { persist(); }, [draft]);
  useEffect(() => {
    const saveOnExit = () => persist();
    window.addEventListener('pagehide', saveOnExit);
    document.addEventListener('visibilitychange', saveOnExit);
    return () => {
      persist();
      window.removeEventListener('pagehide', saveOnExit);
      document.removeEventListener('visibilitychange', saveOnExit);
    };
  }, [key]);
  return {
    failed,
    committed() { stopped.current = true; discardReviewDraft(run); }
  };
}
