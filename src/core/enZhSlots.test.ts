import { describe, expect, it } from 'vitest';
import { evaluateEnZhSlots } from './wordReview';
import type { Meaning } from '../types';

const meanings: Meaning[] = [
  ['v1', 'v.', '收费'], ['n1', 'n.', '费用'], ['v2', 'v.', '指控'], ['n2', 'n.', '指控']
].map(([id, partOfSpeech, chineseMeaning]) => ({ id, wordId: 'w', partOfSpeech, chineseMeaning,
  selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1 }));

describe('词性分组填空', () => {
  it('同词性乱序正确答案跟随填空，不会对照到另一个义项', () => {
    const result = evaluateEnZhSlots(meanings, { v1: '指控', v2: '索价', n1: '指控', n2: '费用' },
      new Map([['v1', ['索价']]]));
    expect(result.map((row) => [row.slotId, row.meaning.id, row.correct])).toEqual([
      ['v1', 'v2', true], ['v2', 'v1', true], ['n1', 'n2', true], ['n2', 'n1', true]
    ]);
  });
  it('其他词性答案不算本组答对，重复答案只匹配一次', () => {
    const result = evaluateEnZhSlots(meanings, { v1: '费用', v2: '收费', n1: '指控', n2: '指控' });
    expect(result.map((row) => row.correct)).toEqual([false, true, true, false]);
    expect(result.find((row) => row.slotId === 'v1')?.meaning.chineseMeaning).toBe('指控');
    expect(result.find((row) => row.slotId === 'n2')?.meaning.chineseMeaning).toBe('费用');
    expect(new Set(result.map((row) => row.meaning.id)).size).toBe(meanings.length);
  });
  it('所有空格都有独立参考答案，保留错填的原始输入', () => {
    const result = evaluateEnZhSlots(meanings, { n1: '不知道' });
    expect(result.every((row) => !row.correct)).toBe(true);
    expect(result.find((row) => row.slotId === 'n1')?.input).toBe('不知道');
    expect(result.map((row) => row.meaning.id)).toEqual(['v1', 'v2', 'n1', 'n2']);
  });
});
