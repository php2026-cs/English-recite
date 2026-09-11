import type { DictionaryLookupResponse } from '../dictionary/dictionaryServiceCore';

export async function resolveCandidatesFromLocalFirst(
  word: string, remoteLookup: (word: string) => Promise<DictionaryLookupResponse>
) {
  const lexicon = await import('./localLexicon');
  return lexicon.resolveCandidatesFromLocalFirst(word, remoteLookup);
}
