import { describe, expect, it } from 'vitest';
import { mergePersonalAliases } from './personalVocabularyRepository';
import { evaluateEnZhSlots } from '../core/wordReview';
import type { Meaning } from '../types';
import type { PersonalMeaningAlias } from '../core/personalVocabulary';

const meaning: Meaning = { id: 'm', wordId: 'w', partOfSpeech: 'v.', chineseMeaning: '收费',
  selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1 };
const alias: PersonalMeaningAlias = { id: 'alias', localOwnerUserId: null, meaningId: 'm', wordId: 'w',
  partOfSpeech: 'v.', chineseMeaning: '收费', alias: '收钱', updatedAt: 1 };

describe('个人可接受答案', () => {
  it('本地词典与个人表达同时有效，仍按义项匹配', () => {
    const aliases = mergePersonalAliases('charge', [meaning], [alias]);
    expect(aliases.get('m')).toContain('收钱');
    expect(aliases.get('m')).toContain('索价');
    expect(evaluateEnZhSlots([meaning], { m: '收钱' }, aliases)[0].correct).toBe(true);
  });
  it('义项、词性或单词归属改变后不沿用旧表达', () => {
    for (const changed of [{ ...meaning, chineseMeaning: '冲锋' }, { ...meaning, partOfSpeech: 'n.' }, { ...meaning, wordId: 'other' }]) {
      expect(mergePersonalAliases('charge', [changed], [alias]).get('m')).not.toContain('收钱');
    }
  });
  it('个人表达不覆盖另一义项的标准答案，也不能重复计数', () => {
    const second = { ...meaning, id: 'm2', chineseMeaning: '收钱' };
    const aliases = mergePersonalAliases('charge', [meaning, second], [alias]);
    const result = evaluateEnZhSlots([meaning, second], { m: '收钱', m2: '收费' }, aliases);
    expect(result.map((row) => row.meaning.id)).toEqual(['m2', 'm']);
    expect(result.every((row) => row.correct)).toBe(true);
    expect(evaluateEnZhSlots([meaning], { m: '收钱' }, new Map())[0].correct).toBe(false);
  });
});
