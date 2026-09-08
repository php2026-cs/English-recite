import { describe, expect, it } from 'vitest';
import type { Meaning } from '../types';
import {
  evaluateEnZhInputs,
  getMatchedMeaningIds,
  getRemainingCountsByPartOfSpeech,
  groupMeaningsByPartOfSpeech
} from './wordReview';

function meaning(
  id: string,
  partOfSpeech: string,
  chineseMeaning: string
): Meaning {
  return {
    id,
    wordId: 'w1',
    partOfSpeech,
    chineseMeaning,
    selectedForStudy: true,
    correctCount: 0,
    incorrectCount: 0,
    createdAt: 1,
    updatedAt: 1
  };
}

const chargeMeanings = [
  meaning('a', 'v.', '收费'),
  meaning('b', 'v.', '指控'),
  meaning('c', 'v.', '冲锋'),
  meaning('d', 'n.', '费用'),
  meaning('e', 'n.', '指控'),
  meaning('f', 'n.', '电荷')
];

describe('word-level review', () => {
  it('同词性输入顺序不同仍能匹配', () => {
    const results = evaluateEnZhInputs(chargeMeanings, [
      '冲锋',
      '收费',
      '指控',
      '费用',
      '电荷',
      ''
    ]);
    expect(getMatchedMeaningIds(results)).toHaveLength(5);
  });

  it('不同词性的同中文义项不会误匹配', () => {
    const results = evaluateEnZhInputs(chargeMeanings, ['指控']);
    const matched = getMatchedMeaningIds(results);
    expect(matched).toHaveLength(1);
    expect(matched[0]).toBe('b');
  });

  it('alias 可以匹配 Meaning', () => {
    const results = evaluateEnZhInputs(
      chargeMeanings,
      ['控告'],
      new Map([['b', ['控告']]])
    );
    expect(getMatchedMeaningIds(results)).toEqual(['b']);
  });

  it('同 Meaning 的 main + alias 不能重复计数', () => {
    const results = evaluateEnZhInputs(
      chargeMeanings,
      ['指控', '控告'],
      new Map([['b', ['控告']]])
    );
    expect(getMatchedMeaningIds(results)).toHaveLength(1);
  });

  it('答对 5 / 6 时还差 n. 1 个', () => {
    const matched = ['a', 'c', 'b', 'd', 'f'];
    const counts = getRemainingCountsByPartOfSpeech(chargeMeanings, matched);
    expect(counts.get('v.')).toBeUndefined();
    expect(counts.get('n.')).toBe(1);
  });

  it('按词性分组并保持稳定顺序', () => {
    expect(groupMeaningsByPartOfSpeech(chargeMeanings)).toHaveLength(2);
  });
});
