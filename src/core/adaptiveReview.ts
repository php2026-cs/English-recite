import type {
  Meaning,
  MeaningPerformanceProfile,
  MeaningReviewState,
  ReviewQuestionType,
  Word
} from '../types';

export interface ReviewQuestion {
  id: string;
  meaningId: string;
  wordId: string;
  questionType: ReviewQuestionType;
  startedAt: number;
  prompt: {
    word: string;
    phonetic?: string;
    partOfSpeech: string;
    chineseMeaning: string;
    context?: string;
  };
}

export function getAvailableQuestionTypes(options: {
  hasContextExample?: boolean;
}): ReviewQuestionType[] {
  const available: ReviewQuestionType[] = ['en-to-zh', 'zh-to-en', 'spelling'];
  if (options.hasContextExample) {
    available.push('context');
  }
  return available;
}

export function selectAvailableQuestionType(
  suggested: ReviewQuestionType,
  available: ReviewQuestionType[]
): ReviewQuestionType {
  if (available.includes(suggested)) return suggested;
  if (available.includes('zh-to-en')) return 'zh-to-en';
  return available[0];
}

export function createReviewQuestion(input: {
  id: string;
  word: Word;
  meaning: Meaning;
  questionType: ReviewQuestionType;
  contextExample?: string;
  startedAt?: number;
}): ReviewQuestion {
  return {
    id: input.id,
    meaningId: input.meaning.id,
    wordId: input.word.id,
    questionType: input.questionType,
    startedAt: input.startedAt ?? Date.now(),
    prompt: {
      word: input.word.word,
      phonetic: input.word.phonetic,
      partOfSpeech: input.meaning.partOfSpeech,
      chineseMeaning: input.meaning.chineseMeaning,
      context: input.contextExample
    }
  };
}

export function isContextQuestionEligible(
  meaning: Meaning,
  contextExample?: string
): boolean {
  void meaning;
  return Boolean(contextExample?.trim());
}

export function getSuggestedTypeForQuestion(
  profile: MeaningPerformanceProfile | undefined,
  reviewState: MeaningReviewState | undefined,
  available: ReviewQuestionType[],
  suggested: ReviewQuestionType
): ReviewQuestionType {
  void profile;
  void reviewState;
  return selectAvailableQuestionType(suggested, available);
}
