import {
  createReviewQuestion,
  getAvailableQuestionTypes,
  selectAvailableQuestionType,
  type ReviewQuestion
} from '../../core/adaptiveReview';
import { createId } from '../../lib/id';
import { performanceRepository } from '../../repositories/performanceRepository';
import { reviewStateRepository } from '../srs/reviewState';
import { selectQuestionType } from './personalizationEngine';
import type { Meaning, Word } from '../../types';

export async function buildAdaptiveReviewQuestion(input: {
  word: Word;
  meaning: Meaning;
  contextExample?: string;
  now?: number;
}): Promise<ReviewQuestion> {
  const profile = await performanceRepository.getProfile(input.meaning.id);
  const reviewState = await reviewStateRepository.get(input.meaning.id);
  const suggested = selectQuestionType(profile, reviewState).questionType;
  const available = getAvailableQuestionTypes({
    hasContextExample: Boolean(input.contextExample?.trim())
  });
  const questionType = selectAvailableQuestionType(suggested, available);
  return createReviewQuestion({
    id: createId(),
    word: input.word,
    meaning: input.meaning,
    questionType,
    contextExample: input.contextExample,
    startedAt: input.now
  });
}

// Pick the most urgent eligible sense's plan; the question covers the entire word group.
// Context is unavailable until we have examples that cover the assessed senses.
export async function buildAdaptiveWordQuestion(word: Word, meanings: Meaning[]): Promise<ReviewQuestion> {
  if (meanings.length === 0) throw new Error('没有可复习的义项');
  const plans = await Promise.all(meanings.map(async (meaning) => {
    const profile = await performanceRepository.getProfile(meaning.id);
    const state = await reviewStateRepository.get(meaning.id);
    return { meaning, plan: selectQuestionType(profile, state) };
  }));
  plans.sort((a, b) => b.plan.priority - a.plan.priority);
  const selected = plans[0];
  return createReviewQuestion({
    id: createId(), word, meaning: selected.meaning,
    questionType: selectAvailableQuestionType(selected.plan.questionType, getAvailableQuestionTypes({}))
  });
}
