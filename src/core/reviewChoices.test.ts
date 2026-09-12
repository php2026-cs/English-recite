import { describe, expect, it } from 'vitest';
import { buildReviewChoices, spellingDistance } from './reviewChoices';
import { localLexicon } from '../services/lexicon/localLexicon';
import type { ReviewRunItem } from './reviewRun';

const item: ReviewRunItem = { taskId: 'stable-choice', retry: 0, overdueDays: 0,
  word: { id: 'charge', word: 'charge', createdAt: 1, updatedAt: 1 },
  meanings: ['收费', '指控'].map((chineseMeaning, i) => ({id: String(i), wordId: 'charge', partOfSpeech: 'v.', chineseMeaning,
    selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1})) };
describe('形近词选择题', () => {
  it('优先衡量拼写相似程度', () => {
    expect(spellingDistance('charge', 'change')).toBe(1);
    expect(spellingDistance('charge', 'charge')).toBe(0);
  });
  it('包括全部正确义项、去重并在刷新后保持同样次序', () => {
    const entries = localLexicon.list();
    const choices = buildReviewChoices(item, 'en-zh', entries);
    expect(choices.filter(c => c.meaningIds.length)).toHaveLength(2);
    expect(choices.length).toBeGreaterThan(2);
    expect(new Set(choices.map(c => c.label)).size).toBe(choices.length);
    expect(buildReviewChoices(item, 'en-zh', entries)).toEqual(choices);
    expect(choices.filter(c => !c.meaningIds.length).every(c => c.sourceWord !== 'charge')).toBe(true);
  });
  it('中译英只有一个正确英文选项', () => {
    const choices = buildReviewChoices(item, 'zh-en', localLexicon.list());
    expect(choices).toHaveLength(4);
    expect(choices.filter(c => c.meaningIds.length).map(c => c.label)).toEqual(['charge']);
  });
});
