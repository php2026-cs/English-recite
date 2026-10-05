import type { MeaningReviewState } from '../types';

export const WEAKNESS_LABELS = {
  meaning: '认不出中文',
  spelling: '拼不出英文',
  confusion: '容易混淆'
} as const;
export type StudyWeakness = keyof typeof WEAKNESS_LABELS;

export function readWeaknesses(state?: MeaningReviewState): StudyWeakness[] {
  const support = state?.fsrsData?.studySupport as { weaknesses?: unknown } | undefined;
  return normalizeWeaknesses(support?.weaknesses);
}

export function normalizeWeaknesses(value: unknown): StudyWeakness[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is StudyWeakness => typeof item === 'string' && Object.prototype.hasOwnProperty.call(WEAKNESS_LABELS, item)))];
}

export function preferredWeaknessDirection(weaknesses: StudyWeakness[]): 'en-to-zh' | 'spelling' | undefined {
  // A mixed mark leaves the existing adaptive planner free to choose.
  if (weaknesses.includes('spelling') && !weaknesses.includes('meaning')) return 'spelling';
  if (weaknesses.includes('meaning') && !weaknesses.includes('spelling')) return 'en-to-zh';
  return undefined;
}
