export const PART_OF_SPEECH_OPTIONS = [
  'n.',
  'v.',
  'adj.',
  'adv.',
  'prep.',
  'conj.',
  'pron.',
  'num.',
  'interj.',
  'phrase',
  'other'
] as const;

export type ReviewMode = 'zh-to-en' | 'en-to-zh';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
export type ReviewQuestionType =
  | 'zh-to-en'
  | 'en-to-zh'
  | 'spelling'
  | 'context'
  | 'confusion';

export type ReviewErrorType =
  | 'unknown'
  | 'wrong_meaning'
  | 'wrong_part_of_speech'
  | 'spelling_error'
  | 'slow_recall'
  | 'confusion'
  | 'other';

export interface Word {
  id: string;
  word: string;
  phonetic?: string;
  localOwnerUserId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Meaning {
  id: string;
  wordId: string;
  localOwnerUserId?: string | null;
  partOfSpeech: string;
  chineseMeaning: string;
  selectedForStudy: boolean;
  correctCount: number;
  incorrectCount: number;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewRecord {
  id: string;
  wordId: string;
  meaningId?: string;
  mode: ReviewMode;
  correct: boolean;
  result?: ReviewRating;
  previousDueAt?: number;
  nextDueAt?: number;
  responseTimeMs?: number;
  questionType?: ReviewQuestionType;
  errorType?: ReviewErrorType;
  confidence?: number;
  inputValue?: string;
  hintUsed?: boolean;
  reviewedAt: number;
  localOwnerUserId?: string | null;
}

export interface MeaningReviewState {
  meaningId: string;
  localOwnerUserId?: string | null;
  state: 'new' | 'learning' | 'review' | 'relearning';
  dueAt: number;
  lastReviewAt?: number;
  stability?: number;
  difficulty?: number;
  reps: number;
  lapses: number;
  elapsedDays?: number;
  scheduledDays?: number;
  fsrsData?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  id: 'app';
  dailyNewMeaningLimit: number;
  desiredRetention: number;
  dailyReminderEnabled: boolean;
  reminderTime: string;
  reminderOnlyWhenDue: boolean;
  showDueCount: boolean;
  timezone: string;
}

export interface MeaningPerformanceProfile {
  meaningId: string;
  recognitionScore: number;
  recallScore: number;
  spellingScore: number;
  contextScore: number;
  averageResponseTimeMs?: number;
  medianResponseTimeMs?: number;
  correctCount: number;
  incorrectCount: number;
  confidenceScore?: number;
  updatedAt: number;
}

export interface MeaningDifficulty {
  meaningId: string;
  difficultyScore: number;
  confidence: number;
  updatedAt: number;
}

export interface ConfusionPair {
  id: string;
  wordAId: string;
  wordBId: string;
  confusionScore: number;
  observedCount: number;
  updatedAt: number;
}

export interface ReviewSession {
  id: string;
  wordId: string;
  localOwnerUserId?: string | null;
  mode: 'en-to-zh';
  totalMeanings: number;
  recalledMeaningIds: string[];
  revealedMeaningIds: string[];
  createdAt: number;
}

export type WordWithMeanings = Word & {
  meanings: Meaning[];
};

export interface ImportExportPayload {
  schemaVersion: 1;
  exportedAt: number;
  words: Word[];
  meanings: Meaning[];
  reviewRecords: ReviewRecord[];
  reviewSessions?: ReviewSession[];
  meaningReviewStates?: MeaningReviewState[];
}
