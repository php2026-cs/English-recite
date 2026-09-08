import { describe, expect, it } from 'vitest';
import type { Meaning } from '../types';
import { evaluateAdaptiveWordAnswers } from './adaptiveWordReview';
import { getLexiconAliases } from '../services/lexicon/localLexicon';
import { buildReviewWordQueue } from '../services/srs/reviewQueue';

const word = { id: 'w', word: 'charge', createdAt: 1, updatedAt: 1 };
const meanings: Meaning[] = ['收费', '指控', '充电'].map((chineseMeaning, i) => ({
  id: `m${i}`, wordId: 'w', chineseMeaning, partOfSpeech: 'v.',
  selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1
}));

describe('智能复习单词级判定', () => {
  it('乱序别名按实际匹配义项归属，未回忆的义项单独判错', () => {
    const result = evaluateAdaptiveWordAnswers('charge', meanings, 'en-to-zh',
      ['指控', '索价', ''], getLexiconAliases('CHARGE', meanings));
    expect(result.map((item) => item.correct)).toEqual([true, true, false]);
    expect(result.map((item) => item.inputValue)).toEqual(['索价', '指控', '']);
    expect(result[2].errorType).toBe('wrong_meaning');
  });
  it('重复输入不能重复匹配，别名不跨词性或自定义义项使用', () => {
    const custom = [{ ...meanings[0], chineseMeaning: '自定义收费' },
      { ...meanings[1], chineseMeaning: '收费', partOfSpeech: 'adj.' }];
    expect([...getLexiconAliases('charge', custom).values()]).toEqual([[], []]);
    const result = evaluateAdaptiveWordAnswers('charge', meanings, 'en-to-zh',
      ['收费', '收费', '收费']);
    expect(result.filter((item) => item.correct)).toHaveLength(1);
  });
  it('全空可显式揭晓；英文拼写接受大小写与空格，记录拼写错误类型', () => {
    expect(evaluateAdaptiveWordAnswers('charge', meanings, 'en-to-zh', ['', '', ''])
      .every((item) => !item.correct)).toBe(true);
    expect(evaluateAdaptiveWordAnswers('charge', meanings, 'spelling', [' CHARGE '])
      .every((item) => item.correct)).toBe(true);
    expect(evaluateAdaptiveWordAnswers('charge', meanings, 'spelling', ['chagre'])
      .every((item) => item.errorType === 'spelling_error')).toBe(true);
  });
  it('混合到期、新义项、未来到期、未勾选时只评估本轮符合条件的义项', () => {
    const queue = buildReviewWordQueue([word], [...meanings, { ...meanings[0], id: 'off', selectedForStudy: false }], [
      { meaningId: 'm0', state: 'review', dueAt: 100, reps: 1, lapses: 0, createdAt: 1, updatedAt: 1 },
      { meaningId: 'm2', state: 'review', dueAt: 300, reps: 1, lapses: 0, createdAt: 1, updatedAt: 1 }
    ], { now: 200, dailyNewMeaningLimit: 1 });
    expect(queue).toHaveLength(1);
    expect(queue[0].meanings.map((meaning) => meaning.id)).toEqual(['m0', 'm1']);
    expect(evaluateAdaptiveWordAnswers('charge', queue[0].meanings, 'en-to-zh', ['充电'])
      .every((item) => !item.correct)).toBe(true);
  });
});
