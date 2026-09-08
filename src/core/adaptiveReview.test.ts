import { describe, expect, it } from 'vitest';
import {
  getAvailableQuestionTypes,
  selectAvailableQuestionType
} from './adaptiveReview';

describe('adaptive question eligibility', () => {
  it('无例句时 context unavailable', () => {
    expect(getAvailableQuestionTypes({ hasContextExample: false })).not.toContain(
      'context'
    );
  });

  it('有例句时 context available', () => {
    expect(getAvailableQuestionTypes({ hasContextExample: true })).toContain('context');
  });

  it('context 不可用时会 fallback', () => {
    expect(
      selectAvailableQuestionType('context', ['en-to-zh', 'zh-to-en', 'spelling'])
    ).toBe('zh-to-en');
  });
});
