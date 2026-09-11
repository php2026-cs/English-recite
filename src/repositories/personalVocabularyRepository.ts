import { db } from '../db/db';
import { normalizeChinese } from '../lib/strings';
import type { Meaning } from '../types';
import { getCurrentOwnerUserId } from '../services/ownership/ownership';
import { getLexiconAliases } from '../services/lexicon/lexiconAliases';
import type { PersonalMeaningAlias } from '../core/personalVocabulary';

export function mergePersonalAliases(word: string, meanings: Meaning[], personal: PersonalMeaningAlias[]): Map<string, string[]> {
  const aliases = getLexiconAliases(word, meanings);
  for (const meaning of meanings) {
    aliases.set(meaning.id, [...(aliases.get(meaning.id) ?? []), ...personal
      .filter((row) => row.meaningId === meaning.id && row.wordId === meaning.wordId &&
        row.partOfSpeech === meaning.partOfSpeech && row.chineseMeaning === meaning.chineseMeaning)
      .map((row) => row.alias)]);
  }
  return aliases;
}

export const personalVocabularyRepository = {
  listAliases() {
    const owner = getCurrentOwnerUserId();
    return db.personalMeaningAliases.filter((row) => row.localOwnerUserId === owner).toArray();
  },
  async accept(meaning: Meaning, input: string): Promise<void> {
    const owner = getCurrentOwnerUserId();
    const alias = input.trim();
    if (!normalizeChinese(alias) || alias.length > 200) throw new Error('可接受答案需要包含文字，且不超过 200 字');
    await db.transaction('rw', [db.meanings, db.personalMeaningAliases], async () => {
      const stored = await db.meanings.get(meaning.id);
      if (!stored || (stored.localOwnerUserId ?? null) !== owner || getCurrentOwnerUserId() !== owner ||
        stored.chineseMeaning !== meaning.chineseMeaning || stored.partOfSpeech !== meaning.partOfSpeech) throw new Error('义项已变更，请重新进入复习');
      await db.personalMeaningAliases.put({
        id: JSON.stringify([owner, meaning.id, normalizeChinese(alias)]), localOwnerUserId: owner,
        meaningId: meaning.id, wordId: meaning.wordId, partOfSpeech: meaning.partOfSpeech,
        chineseMeaning: meaning.chineseMeaning, alias, updatedAt: Date.now()
      });
    });
  },
  async removeAlias(id: string): Promise<void> {
    await db.transaction('rw', db.personalMeaningAliases, async () => {
      const row = await db.personalMeaningAliases.get(id);
      if (row?.localOwnerUserId === getCurrentOwnerUserId()) await db.personalMeaningAliases.delete(id);
    });
  }
};
