import type {
  MeaningDifficulty,
  MeaningPerformanceProfile,
  MeaningReviewState,
  ReviewQuestionType
} from '../../types';

export interface ReviewSignal {
  meaningId: string;
  questionType: ReviewQuestionType;
  correct: boolean;
  responseTimeMs?: number;
  confidence?: number;
  fsrsDifficulty?: number;
  lapses?: number;
  reviewedAt?: number;
}

export interface QuestionPlan {
  questionType: ReviewQuestionType;
  reason: string;
  priority: number;
}

const DEFAULT_MIN_SAMPLES = 6;
const DEFAULT_TYPE_MIX: ReviewQuestionType[] = ['en-to-zh', 'zh-to-en'];

export function createEmptyPerformanceProfile(
  meaningId: string,
  now = Date.now()
): MeaningPerformanceProfile {
  return {
    meaningId,
    recognitionScore: 0.5,
    recallScore: 0.5,
    spellingScore: 0.5,
    contextScore: 0.5,
    correctCount: 0,
    incorrectCount: 0,
    updatedAt: now
  };
}

export function updatePerformanceProfile(
  existing: MeaningPerformanceProfile | undefined,
  signal: ReviewSignal
): MeaningPerformanceProfile {
  const profile = existing ?? createEmptyPerformanceProfile(signal.meaningId);
  const now = signal.reviewedAt ?? Date.now();
  const correctness = signal.correct ? 1 : 0;

  profile.correctCount += correctness;
  profile.incorrectCount += signal.correct ? 0 : 1;

  if (signal.questionType === 'en-to-zh') {
    profile.recognitionScore = weightedAverage(profile.recognitionScore, correctness);
  } else if (signal.questionType === 'zh-to-en') {
    profile.recallScore = weightedAverage(profile.recallScore, correctness);
  } else if (signal.questionType === 'spelling') {
    profile.spellingScore = weightedAverage(profile.spellingScore, correctness);
  } else if (signal.questionType === 'context') {
    profile.contextScore = weightedAverage(profile.contextScore, correctness);
  }

  if (typeof signal.responseTimeMs === 'number') {
    profile.averageResponseTimeMs = typeof profile.averageResponseTimeMs === 'number'
      ? (profile.averageResponseTimeMs + signal.responseTimeMs) / 2
      : signal.responseTimeMs;
  }
  if (typeof signal.confidence === 'number') {
    profile.confidenceScore = typeof profile.confidenceScore === 'number'
      ? (profile.confidenceScore + signal.confidence) / 2
      : signal.confidence;
  }
  profile.updatedAt = now;
  return profile;
}

export function calculateDifficulty(
  profile: MeaningPerformanceProfile | undefined,
  reviewState: MeaningReviewState | undefined,
  fsrsDifficulty?: number
): MeaningDifficulty {
  const total = (profile?.correctCount ?? 0) + (profile?.incorrectCount ?? 0);
  const errorRate = total > 0 ? (profile?.incorrectCount ?? 0) / total : 0;
  const lapses = reviewState?.lapses ?? 0;
  const slowRecallPenalty = profile?.averageResponseTimeMs
    ? Math.min(0.15, profile.averageResponseTimeMs / 30_000)
    : 0;
  const fsrsComponent = Math.max(1, Math.min(10, fsrsDifficulty ?? 5)) / 10;
  const difficultyScore = clamp(
    errorRate * 0.5 + fsrsComponent * 0.35 + lapses * 0.05 + slowRecallPenalty,
    0,
    1
  );
  return {
    meaningId: profile?.meaningId ?? reviewState?.meaningId ?? '',
    difficultyScore,
    confidence: total > 0 ? clamp(1 - errorRate, 0, 1) : 0.5,
    updatedAt: Date.now()
  };
}

export function classifyResponseTime(
  responseTimeMs: number | undefined,
  personalMedianMs: number | undefined
): 'fast' | 'normal' | 'slow' | 'unknown' {
  if (!responseTimeMs) return 'unknown';
  if (!personalMedianMs) return responseTimeMs <= 2500 ? 'fast' : 'normal';
  const ratio = responseTimeMs / personalMedianMs;
  if (ratio <= 0.75) return 'fast';
  if (ratio >= 1.5) return 'slow';
  return 'normal';
}

export function selectQuestionType(
  profile: MeaningPerformanceProfile | undefined,
  reviewState: MeaningReviewState | undefined,
  options: {
    minimumSamples?: number;
    defaultMix?: ReviewQuestionType[];
    seed?: number;
  } = {}
): QuestionPlan {
  const minimumSamples = options.minimumSamples ?? DEFAULT_MIN_SAMPLES;
  const defaultMix = options.defaultMix ?? DEFAULT_TYPE_MIX;
  const lapses = reviewState?.lapses ?? 0;
  const totalSamples =
    (profile?.correctCount ?? 0) + (profile?.incorrectCount ?? 0);
  if (!profile || totalSamples < minimumSamples) {
    const selected =
      defaultMix[Math.abs((options.seed ?? 0) + totalSamples) % defaultMix.length];
    return {
      questionType: selected,
      reason: 'insufficient-data',
      priority: 0
    };
  }

  const candidates: Array<{
    type: ReviewQuestionType;
    score: number;
    reason: string;
  }> = [
    { type: 'en-to-zh', score: profile.recognitionScore, reason: 'recognition-weak' },
    { type: 'zh-to-en', score: profile.recallScore, reason: 'recall-weak' },
    { type: 'spelling', score: profile.spellingScore, reason: 'spelling-weak' },
    { type: 'context', score: profile.contextScore, reason: 'context-weak' }
  ];
  candidates.sort((a, b) => a.score - b.score);
  const weakest = candidates[0];
  return {
    questionType: weakest.type,
    reason: weakest.reason,
    priority: Math.round((1 - weakest.score) * 100 + lapses * 2)
  };
}

export function getSuggestedTypeMix(
  profile: MeaningPerformanceProfile,
  options: {
    min?: number;
    max?: number;
  } = {}
): Record<'en-to-zh' | 'zh-to-en', number> {
  const min = options.min ?? 0.2;
  const max = options.max ?? 0.8;
  const recognitionWeakness = 1 - profile.recognitionScore;
  const recallWeakness = 1 - profile.recallScore;
  const totalWeakness = recognitionWeakness + recallWeakness || 1;
  const recognitionRatio = clamp(recognitionWeakness / totalWeakness, min, max);
  const recallRatio = clamp(recallWeakness / totalWeakness, min, max);
  const normalized = recognitionRatio + recallRatio || 1;
  return {
    'en-to-zh': recognitionRatio / normalized,
    'zh-to-en': recallRatio / normalized
  };
}

function weightedAverage(
  current: number,
  next: number,
  weight = 0.25
): number {
  return clamp(current * (1 - weight) + next * weight, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
