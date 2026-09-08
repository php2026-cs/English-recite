import { describe, expect, it } from 'vitest';
import type { MeaningPerformanceProfile, MeaningReviewState } from '../../types';
import {
  calculateDifficulty,
  classifyResponseTime,
  createEmptyPerformanceProfile,
  getSuggestedTypeMix,
  selectQuestionType,
  updatePerformanceProfile
} from './personalizationEngine';

describe('personalization engine', () => {
  it('复习用时保留毫秒量级，信心分保留 0–3 量级和零值', () => {
    const profile = createEmptyPerformanceProfile('m1');
    profile.averageResponseTimeMs = 4000;
    profile.confidenceScore = 0;
    const updated = updatePerformanceProfile(profile, {
      meaningId: 'm1', questionType: 'en-to-zh', correct: true,
      responseTimeMs: 6000, confidence: 3
    });
    expect(updated.averageResponseTimeMs).toBe(5000);
    expect(updated.confidenceScore).toBe(1.5);
  });
  it('en-to-zh 正确会提升 recognitionScore', () => {
    const profile = createEmptyPerformanceProfile('m1');
    const updated = updatePerformanceProfile(profile, {
      meaningId: 'm1',
      questionType: 'en-to-zh',
      correct: true
    });
    expect(updated.recognitionScore).toBeGreaterThan(0.5);
  });

  it('zh-to-en 错误会降低 recallScore', () => {
    const profile = createEmptyPerformanceProfile('m1');
    const updated = updatePerformanceProfile(profile, {
      meaningId: 'm1',
      questionType: 'zh-to-en',
      correct: false
    });
    expect(updated.recallScore).toBeLessThan(0.5);
  });

  it('recall 弱时会选择 zh-to-en', () => {
    const profile: MeaningPerformanceProfile = {
      ...createEmptyPerformanceProfile('m1'),
      recognitionScore: 0.9,
      recallScore: 0.3,
      spellingScore: 0.7,
      contextScore: 0.7,
      correctCount: 8,
      incorrectCount: 2
    };
    expect(selectQuestionType(profile, undefined).questionType).toBe('zh-to-en');
  });

  it('数据不足时使用默认题型', () => {
    const profile = createEmptyPerformanceProfile('m1');
    expect(
      selectQuestionType(profile, undefined, {
        minimumSamples: 10,
        defaultMix: ['en-to-zh']
      }).questionType
    ).toBe('en-to-zh');
  });

  it('response time 分类正确', () => {
    expect(classifyResponseTime(1200, 2000)).toBe('fast');
    expect(classifyResponseTime(2000, 2000)).toBe('normal');
    expect(classifyResponseTime(4000, 2000)).toBe('slow');
  });

  it('difficulty 受错误率和 lapse 影响', () => {
    const profile = createEmptyPerformanceProfile('m1');
    profile.correctCount = 1;
    profile.incorrectCount = 3;
    const state: MeaningReviewState = {
      meaningId: 'm1',
      state: 'review',
      dueAt: 1,
      reps: 2,
      lapses: 2,
      createdAt: 1,
      updatedAt: 1
    };
    const difficulty = calculateDifficulty(profile, state, 7);
    expect(difficulty.difficultyScore).toBeGreaterThan(0.4);
  });

  it('题型比例会向 recall 弱的方向倾斜', () => {
    const profile: MeaningPerformanceProfile = {
      ...createEmptyPerformanceProfile('m1'),
      recognitionScore: 0.9,
      recallScore: 0.4
    };
    const mix = getSuggestedTypeMix(profile);
    expect(mix['zh-to-en']).toBeGreaterThan(mix['en-to-zh']);
  });
});
