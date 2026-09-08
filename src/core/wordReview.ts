import { normalizeChinese, normalizeEnglish } from '../lib/strings';
import type { Meaning } from '../types';

export interface MeaningGroup {
  partOfSpeech: string;
  meanings: Meaning[];
}

export interface EnZhInputResult {
  input: string;
  matchedMeaningId?: string;
  status: 'matched' | 'unmatched';
}

export interface EnZhSlotResult {
  slotId: string;
  meaning: Meaning;
  input: string;
  correct: boolean;
}

// Match only inside each POS group, then place each still-missing answer under
// one unmatched slot. A correct, out-of-order input keeps its actual answer.
export function evaluateEnZhSlots(
  meanings: Meaning[],
  inputs: Record<string, string>,
  aliases = new Map<string, string[]>()
): EnZhSlotResult[] {
  return groupMeaningsByPartOfSpeech(meanings).flatMap((group) => {
    const matches = evaluateEnZhInputs(group.meanings,
      group.meanings.map((meaning) => inputs[meaning.id] ?? ''), aliases);
    const matchedIds = new Set(getMatchedMeaningIds(matches));
    const remaining = group.meanings.filter((meaning) => !matchedIds.has(meaning.id));
    return group.meanings.map((slot, index) => ({
      slotId: slot.id,
      meaning: group.meanings.find((meaning) => meaning.id === matches[index].matchedMeaningId) ?? remaining.shift()!,
      input: inputs[slot.id] ?? '',
      correct: matches[index].status === 'matched'
    }));
  });
}

export function isEnglishAnswerCorrect(input: string, word: string): boolean {
  return normalizeEnglish(input) === normalizeEnglish(word);
}

export function groupMeaningsByPartOfSpeech(meanings: Meaning[]): MeaningGroup[] {
  const groups: MeaningGroup[] = [];
  const indexByPos = new Map<string, number>();
  for (const meaning of meanings) {
    const index = indexByPos.get(meaning.partOfSpeech);
    if (index === undefined) {
      indexByPos.set(meaning.partOfSpeech, groups.length);
      groups.push({ partOfSpeech: meaning.partOfSpeech, meanings: [meaning] });
    } else {
      groups[index].meanings.push(meaning);
    }
  }
  return groups;
}

export function evaluateEnZhInputs(
  meanings: Meaning[],
  inputs: string[],
  aliasesByMeaningId: Map<string, string[]> = new Map()
): EnZhInputResult[] {
  const remaining = [...meanings];
  const results: EnZhInputResult[] = inputs.map((input) => ({ input, status: 'unmatched' }));
  // Reserve exact answers first so a broad personal alias cannot steal another
  // sense's canonical answer merely because its input slot comes earlier.
  for (const exactOnly of [true, false]) {
    results.forEach((result) => {
      if (result.status === 'matched') return;
      const normalized = normalizeChinese(result.input);
      if (!normalized) return;
      const index = remaining.findIndex((meaning) => exactOnly
        ? normalizeChinese(meaning.chineseMeaning) === normalized
        : matchesMeaning(meaning, normalized, aliasesByMeaningId));
      if (index < 0) return;
      const [matched] = remaining.splice(index, 1);
      result.matchedMeaningId = matched.id;
      result.status = 'matched';
    });
  }
  return results;
}

export function getMatchedMeaningIds(
  results: EnZhInputResult[]
): string[] {
  return results
    .filter((result) => result.status === 'matched')
    .map((result) => result.matchedMeaningId)
    .filter((id): id is string => Boolean(id));
}

export function getRemainingCountsByPartOfSpeech(
  meanings: Meaning[],
  matchedMeaningIds: string[]
): Map<string, number> {
  const matched = new Set(matchedMeaningIds);
  const counts = new Map<string, number>();
  for (const meaning of meanings) {
    if (matched.has(meaning.id)) continue;
    counts.set(meaning.partOfSpeech, (counts.get(meaning.partOfSpeech) ?? 0) + 1);
  }
  return counts;
}

function matchesMeaning(
  meaning: Meaning,
  normalizedInput: string,
  aliasesByMeaningId: Map<string, string[]>
): boolean {
  if (normalizeChinese(meaning.chineseMeaning) === normalizedInput) return true;
  const aliases = aliasesByMeaningId.get(meaning.id) ?? [];
  return aliases.some((alias) => normalizeChinese(alias) === normalizedInput);
}
