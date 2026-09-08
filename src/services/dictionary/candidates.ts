import { createId } from '../../lib/id';
import { normalizeChinese } from '../../lib/strings';
import { normalizePartOfSpeech } from './dictionaryProvider';

export interface CandidateMeaning {
  id: string;
  partOfSpeech: string;
  chineseMeaning: string;
  selectedForStudy: boolean;
  source?: 'dictionary' | 'manual' | 'edited' | 'lexicon';
  sourceDefinition?: string;
  translatedDefinition?: string;
  isManual?: boolean;
}

export interface CandidateMeaningInput {
  partOfSpeech: string;
  chineseMeaning: string;
  selectedForStudy: boolean;
}

export function createCandidateMeaning(
  input: CandidateMeaningInput,
  source: CandidateMeaning['source'] = 'manual',
  metadata?: {
    sourceDefinition?: string;
    translatedDefinition?: string;
  }
): CandidateMeaning {
  return {
    id: createId(),
    partOfSpeech: input.partOfSpeech.trim(),
    chineseMeaning: input.chineseMeaning.trim(),
    selectedForStudy: input.selectedForStudy,
    source,
    sourceDefinition: metadata?.sourceDefinition,
    translatedDefinition: metadata?.translatedDefinition,
    isManual: source === 'manual'
  };
}

export function updateCandidateMeaning(
  candidates: CandidateMeaning[],
  id: string,
  input: CandidateMeaningInput
): CandidateMeaning[] {
  return candidates.map((candidate) =>
    candidate.id === id
      ? {
          ...candidate,
          partOfSpeech: input.partOfSpeech.trim(),
          chineseMeaning: input.chineseMeaning.trim(),
          selectedForStudy: input.selectedForStudy,
          source: candidate.source === 'dictionary' ? 'edited' : candidate.source
        }
      : candidate
  );
}

export function toggleCandidateMeaning(
  candidates: CandidateMeaning[],
  id: string
): CandidateMeaning[] {
  return candidates.map((candidate) =>
    candidate.id === id
      ? { ...candidate, selectedForStudy: !candidate.selectedForStudy }
      : candidate
  );
}

export function removeCandidateMeaning(
  candidates: CandidateMeaning[],
  id: string
): CandidateMeaning[] {
  return candidates.filter((candidate) => candidate.id !== id);
}

export function candidateKey(partOfSpeech: string, chineseMeaning: string): string {
  return `${normalizePartOfSpeech(partOfSpeech).toLocaleLowerCase()}|${normalizeChinese(chineseMeaning)}`;
}

export function deduplicateCandidates(candidates: CandidateMeaning[]): CandidateMeaning[] {
  const seen = new Set<string>();
  const result: CandidateMeaning[] = [];

  for (const candidate of candidates) {
    const key = candidateKey(candidate.partOfSpeech, candidate.chineseMeaning);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }

  return result;
}

export function filterMissingCandidates(
  existingMeanings: Array<{ partOfSpeech: string; chineseMeaning: string }>,
  candidates: CandidateMeaning[]
): CandidateMeaning[] {
  const existingKeys = new Set(
    existingMeanings.map((meaning) =>
      candidateKey(meaning.partOfSpeech, meaning.chineseMeaning)
    )
  );
  return candidates.filter((candidate) => !existingKeys.has(candidateKey(candidate.partOfSpeech, candidate.chineseMeaning)));
}

export function shouldFillPhonetic(
  currentPhonetic: string | undefined,
  fetchedPhonetic: string | undefined
): boolean {
  return !currentPhonetic?.trim() && Boolean(fetchedPhonetic?.trim());
}

export interface CandidateGroup {
  partOfSpeech: string;
  candidates: CandidateMeaning[];
}

export function groupCandidatesByPartOfSpeech(
  candidates: CandidateMeaning[]
): CandidateGroup[] {
  const groups: CandidateGroup[] = [];
  const indexByPartOfSpeech = new Map<string, number>();

  for (const candidate of candidates) {
    const existingIndex = indexByPartOfSpeech.get(candidate.partOfSpeech);
    if (existingIndex !== undefined) {
      groups[existingIndex].candidates.push(candidate);
    } else {
      indexByPartOfSpeech.set(candidate.partOfSpeech, groups.length);
      groups.push({ partOfSpeech: candidate.partOfSpeech, candidates: [candidate] });
    }
  }

  return groups;
}

export function setGroupSelected(
  candidates: CandidateMeaning[],
  partOfSpeech: string,
  selectedForStudy: boolean
): CandidateMeaning[] {
  return candidates.map((candidate) =>
    candidate.partOfSpeech === partOfSpeech
      ? { ...candidate, selectedForStudy }
      : candidate
  );
}

export function toMeaningInput(candidate: CandidateMeaning): CandidateMeaningInput {
  return {
    partOfSpeech: candidate.partOfSpeech,
    chineseMeaning: candidate.chineseMeaning,
    selectedForStudy: candidate.selectedForStudy
  };
}
