import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type CardInput,
  type Grade
} from 'ts-fsrs';
import type { MeaningReviewState, ReviewRating } from '../../types';
import { getCurrentOwnerUserId } from '../ownership/ownership';

const RATING_TO_FSRS: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

const FSRS_STATE_TO_MEANING_STATE: Record<string, MeaningReviewState['state']> = {
  New: 'new',
  Learning: 'learning',
  Review: 'review',
  Relearning: 'relearning'
};

const MEANING_STATE_TO_FSRS: Record<MeaningReviewState['state'], State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning
};

export function createEmptyReviewState(
  meaningId: string,
  now = Date.now()
): MeaningReviewState {
  return {
    meaningId,
    localOwnerUserId: getCurrentOwnerUserId(),
    state: 'new',
    dueAt: now,
    reps: 0,
    lapses: 0,
    createdAt: now,
    updatedAt: now
  };
}

function toCardInput(
  state: MeaningReviewState
): CardInput {
  return {
    due: new Date(state.dueAt),
    stability: state.stability ?? 0,
    difficulty: state.difficulty ?? 0,
    elapsed_days: state.elapsedDays ?? 0,
    scheduled_days: state.scheduledDays ?? 0,
    reps: state.reps,
    lapses: state.lapses,
    learning_steps: 0,
    state: MEANING_STATE_TO_FSRS[state.state],
    last_review: state.lastReviewAt ? new Date(state.lastReviewAt) : null
  };
}

export interface FSRSReviewOutcome {
  state: MeaningReviewState;
  nextDueAt: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  scheduledDays: number;
  elapsedDays: number;
}

export function reviewMeaningWithFsrs(
  existingState: MeaningReviewState | undefined,
  meaningId: string,
  rating: ReviewRating,
  desiredRetention = 0.9,
  now = Date.now()
): FSRSReviewOutcome {
  const scheduler = fsrs({
    request_retention: desiredRetention,
    enable_fuzz: false
  });
  const card = existingState
    ? toCardInput(existingState)
    : createEmptyCard(new Date(now));
  const record = scheduler.next(card, new Date(now), RATING_TO_FSRS[rating]);

  const nextCard = record.card;
  const stateName = FSRS_STATE_TO_MEANING_STATE[State[nextCard.state]];
  const nextState: MeaningReviewState = {
    meaningId,
    localOwnerUserId: getCurrentOwnerUserId(),
    state: stateName,
    dueAt: nextCard.due.getTime(),
    lastReviewAt: now,
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    elapsedDays: record.log.elapsed_days,
    scheduledDays: record.log.scheduled_days,
    fsrsData: {
      rating,
      fsrsState: State[nextCard.state],
      logState: State[record.log.state]
    },
    createdAt: existingState?.createdAt ?? now,
    updatedAt: now
  };

  return {
    state: nextState,
    nextDueAt: nextCard.due.getTime(),
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    scheduledDays: record.log.scheduled_days,
    elapsedDays: record.log.elapsed_days
  };
}

export function getFsrsRating(rating: ReviewRating): Grade {
  return RATING_TO_FSRS[rating];
}
