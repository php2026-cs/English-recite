import { isMeaningMatch, shuffle } from '../lib/strings';
import type { Meaning, ReviewMode, Word } from '../types';

export interface ZhEnItem {
  wordId: string;
  word: string;
  meaningId: string;
  partOfSpeech: string;
  chineseMeaning: string;
}

export interface EnZhItem {
  wordId: string;
  word: string;
  phonetic?: string;
  meanings: Meaning[];
}

export type ChineseInputResult =
  | { status: 'matched'; meaningId: string }
  | { status: 'duplicate'; meaningId: string }
  | { status: 'no-match' };

export interface EnZhSessionState {
  wordId: string;
  word: string;
  phonetic?: string;
  meanings: Meaning[];
  completedIds: string[];
  revealed: boolean;
}

export interface RevealedMeaning {
  meaning: Meaning;
  recalled: boolean;
}

export function buildZhEnQueue(words: Word[], meanings: Meaning[]): ZhEnItem[] {
  const wordMap = new Map(words.map((word) => [word.id, word]));
  return meanings
    .filter((meaning) => meaning.selectedForStudy)
    .map((meaning) => {
      const word = wordMap.get(meaning.wordId);
      if (!word) return null;
      return {
        wordId: word.id,
        word: word.word,
        meaningId: meaning.id,
        partOfSpeech: meaning.partOfSpeech,
        chineseMeaning: meaning.chineseMeaning
      };
    })
    .filter((item): item is ZhEnItem => item !== null);
}

export function buildEnZhQueue(words: Word[], meanings: Meaning[]): EnZhItem[] {
  const wordMap = new Map(words.map((word) => [word.id, word]));
  const selectedMeanings = meanings.filter((meaning) => meaning.selectedForStudy);
  const grouped = new Map<string, Meaning[]>();

  for (const meaning of selectedMeanings) {
    const list = grouped.get(meaning.wordId) ?? [];
    list.push(meaning);
    grouped.set(meaning.wordId, list);
  }

  const items: EnZhItem[] = [];
  for (const [wordId, groupedMeanings] of grouped) {
    const word = wordMap.get(wordId);
    if (!word || groupedMeanings.length === 0) continue;
    items.push({
      wordId: word.id,
      word: word.word,
      phonetic: word.phonetic,
      meanings: groupedMeanings
    });
  }
  return items;
}

export function createEnZhSession(item: EnZhItem): EnZhSessionState {
  return {
    wordId: item.wordId,
    word: item.word,
    phonetic: item.phonetic,
    meanings: item.meanings,
    completedIds: [],
    revealed: false
  };
}

export function evaluateChineseInput(
  session: EnZhSessionState,
  input: string
): ChineseInputResult {
  if (session.revealed || !input.trim()) {
    return { status: 'no-match' };
  }

  for (const meaning of session.meanings) {
    if (!isMeaningMatch(input, meaning.chineseMeaning)) continue;
    if (session.completedIds.includes(meaning.id)) {
      return { status: 'duplicate', meaningId: meaning.id };
    }
    return { status: 'matched', meaningId: meaning.id };
  }

  return { status: 'no-match' };
}

export function recallMeaning(
  session: EnZhSessionState,
  meaningId: string
): EnZhSessionState {
  if (session.completedIds.includes(meaningId) || session.revealed) {
    return session;
  }
  return {
    ...session,
    completedIds: [...session.completedIds, meaningId]
  };
}

export function revealEnZhSession(session: EnZhSessionState): EnZhSessionState {
  if (session.revealed) return session;
  return {
    ...session,
    revealed: true
  };
}

export function getRevealedMeanings(session: EnZhSessionState): RevealedMeaning[] {
  return session.meanings.map((meaning) => ({
    meaning,
    recalled: session.completedIds.includes(meaning.id)
  }));
}

export function getRemainingCount(session: EnZhSessionState): number {
  return Math.max(0, session.meanings.length - session.completedIds.length);
}

export function buildShuffledZhEnQueue(words: Word[], meanings: Meaning[]): ZhEnItem[] {
  return shuffle(buildZhEnQueue(words, meanings));
}

export function buildShuffledEnZhQueue(words: Word[], meanings: Meaning[]): EnZhItem[] {
  return shuffle(buildEnZhQueue(words, meanings));
}

export function getQueueSummary(
  mode: ReviewMode,
  words: Word[],
  meanings: Meaning[]
): { itemCount: number; meaningCount: number } {
  const selectedCount = meanings.filter((meaning) => meaning.selectedForStudy).length;
  if (mode === 'zh-to-en') {
    return { itemCount: selectedCount, meaningCount: selectedCount };
  }
  return {
    itemCount: buildEnZhQueue(words, meanings).length,
    meaningCount: selectedCount
  };
}
