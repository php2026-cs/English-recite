import { describe, expect, it, vi } from 'vitest';
import entries from '../../data/lexicon/cet6.json';
import type { LexiconData } from '../../data/lexicon/types';
import { getAliasSenses } from './lexiconAliases';
import { resolveCandidatesFromLocalFirst } from './lookupCandidates';

describe('lightweight review aliases', () => {
  it('keeps every alias and its meaning identical to the complete dictionary', () => {
    for (const [word, entry] of Object.entries(entries as LexiconData)) {
      const expected = entry.senses.filter(s => s.aliases?.length)
        .map(s => ({ partOfSpeech: s.partOfSpeech, chineseMeaning: s.chineseMeaning, aliases: s.aliases }));
      expect(getAliasSenses(word)).toEqual(expected);
    }
  });
  it('lazy lookup still finds local words without calling the remote provider', async () => {
    const remote = vi.fn();
    const result = await resolveCandidatesFromLocalFirst('charge', remote);
    expect(result.source).toBe('lexicon');
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(remote).not.toHaveBeenCalled();
  });
});
