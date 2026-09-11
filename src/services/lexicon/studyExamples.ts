import { normalizeChinese } from '../../lib/strings';
import type { Meaning, MeaningReviewState } from '../../types';
import { studyExamples, type StudyExample } from '../../data/lexicon/studyExamples';
import { getAliasSenses } from './lexiconAliases';

export function findStudyExample(word: string, meaning: Meaning): StudyExample | undefined {
  const examples = studyExamples[word.trim().toLowerCase()];
  if (!examples) return undefined;
  // A user-entered alias may share the canonical sense's teaching example.
  const candidates = [meaning.chineseMeaning, ...(getAliasSenses(word)
    .filter((sense) => sense.partOfSpeech === meaning.partOfSpeech &&
      [sense.chineseMeaning, ...(sense.aliases ?? [])].some((gloss) =>
        normalizeChinese(gloss) === normalizeChinese(meaning.chineseMeaning)))
    .map((sense) => sense.chineseMeaning) ?? [])];
  return Object.entries(examples).find(([key]) => {
    const [pos, gloss] = key.split('|');
    return pos === meaning.partOfSpeech && candidates.some((candidate) =>
      normalizeChinese(candidate) === normalizeChinese(gloss));
  })?.[1];
}

export function isFirstStudy(meaning: Meaning, state?: MeaningReviewState): boolean {
  return !meaning.lastReviewedAt && meaning.correctCount + meaning.incorrectCount === 0 &&
    !state?.lastReviewAt && !(state && state.reps > 0);
}
