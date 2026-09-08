import cet6Data from '../../data/lexicon/cet6.json';
import type { LexiconData, LexiconEntry, LexiconSense } from '../../data/lexicon/types';
import {
  createCandidateMeaning,
  type CandidateMeaning
} from '../dictionary/candidates';
import type { DictionaryLookupResponse } from '../dictionary/dictionaryServiceCore';
import type { Meaning } from '../../types';
import { normalizeChinese } from '../../lib/strings';

const cet6Entries = cet6Data as LexiconData;

export function getLexiconAliases(word: string, meanings: Meaning[]): Map<string, string[]> {
  const entry = localLexicon.lookup(word);
  return new Map(meanings.map((meaning) => [
    meaning.id,
    entry?.senses.filter((sense) =>
      sense.partOfSpeech === meaning.partOfSpeech &&
      normalizeChinese(sense.chineseMeaning) === normalizeChinese(meaning.chineseMeaning)
    ).flatMap((sense) => sense.aliases ?? []) ?? []
  ]));
}

export function normalizeLexiconWord(word: string): string {
  return word.trim().toLowerCase();
}

export const localLexicon = {
  lookup(word: string): LexiconEntry | undefined {
    return cet6Entries[normalizeLexiconWord(word)];
  },

  search(query: string): LexiconEntry[] {
    const normalizedQuery = normalizeLexiconWord(query);
    return Object.values(cet6Entries)
      .filter((entry) => !normalizedQuery || entry.word.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.word.localeCompare(b.word));
  },

  list(): LexiconEntry[] {
    return Object.values(cet6Entries).sort((a, b) => a.word.localeCompare(b.word));
  },

  count(): number {
    return Object.keys(cet6Entries).length;
  }
};

export function lexiconSenseToCandidate(sense: LexiconSense): CandidateMeaning {
  return {
    id: `candidate:${sense.id}`,
    partOfSpeech: sense.partOfSpeech,
    chineseMeaning: sense.chineseMeaning,
    selectedForStudy: false,
    source: 'lexicon',
    sourceDefinition: sense.englishDefinition,
    isManual: false
  };
}

export function lexiconEntryToCandidates(entry: LexiconEntry): CandidateMeaning[] {
  return entry.senses.map(lexiconSenseToCandidate);
}

export interface ResolvedCandidates {
  source: 'lexicon' | 'remote';
  phonetic?: string;
  fromCache: boolean;
  candidates: CandidateMeaning[];
}

export async function resolveCandidatesFromLocalFirst(
  word: string,
  remoteLookup: (word: string) => Promise<DictionaryLookupResponse>
): Promise<ResolvedCandidates> {
  const localEntry = localLexicon.lookup(word);
  if (localEntry) {
    return {
      source: 'lexicon',
      phonetic: localEntry.phonetic,
      fromCache: false,
      candidates: lexiconEntryToCandidates(localEntry)
    };
  }

  const remote = await remoteLookup(word);
  return {
    source: 'remote',
    phonetic: remote.phonetic,
    fromCache: remote.fromCache,
    candidates: remote.meanings.map((meaning) =>
      createCandidateMeaning(
        {
          partOfSpeech: meaning.partOfSpeech,
          chineseMeaning: meaning.chineseMeaning,
          selectedForStudy: false
        },
        'dictionary',
        {
          sourceDefinition: meaning.englishDefinition,
          translatedDefinition: meaning.translatedDefinition
        }
      )
    )
  };
}
