import type { Meaning, ReviewErrorType, ReviewQuestionType } from '../types';
import { evaluateEnZhInputs, isEnglishAnswerCorrect } from './wordReview';

export interface AdaptiveMeaningResult {
  meaning: Meaning;
  correct: boolean;
  inputValue: string;
  errorType?: ReviewErrorType;
}

export function evaluateAdaptiveWordAnswers(
  word: string,
  meanings: Meaning[],
  questionType: ReviewQuestionType,
  answers: string[],
  aliases = new Map<string, string[]>()
): AdaptiveMeaningResult[] {
  const matches = questionType === 'en-to-zh'
    ? evaluateEnZhInputs(meanings, answers, aliases)
    : [];
  return meanings.map((meaning) => {
    const match = matches.find((item) => item.matchedMeaningId === meaning.id);
    const correct = questionType === 'en-to-zh'
      ? Boolean(match)
      : isEnglishAnswerCorrect(answers[0] ?? '', word);
    return {
      meaning,
      correct,
      // Unmatched Chinese inputs cannot reliably be attributed to an individual sense.
      inputValue: questionType === 'en-to-zh' ? match?.input ?? '' : answers[0] ?? '',
      errorType: correct ? undefined : questionType === 'en-to-zh'
        ? 'wrong_meaning' : questionType === 'spelling' ? 'spelling_error' : 'unknown'
    };
  });
}
