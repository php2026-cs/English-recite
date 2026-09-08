import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performanceRepository } from '../../repositories/performanceRepository';
import { buildAdaptiveWordQuestion } from './reviewController';
import { createEmptyPerformanceProfile } from './personalizationEngine';

vi.mock('../../repositories/performanceRepository', () => ({ performanceRepository: { getProfile: vi.fn() } }));
vi.mock('../srs/reviewState', () => ({ reviewStateRepository: { get: vi.fn() } }));
const word = { id: 'w', word: 'charge', createdAt: 1, updatedAt: 1 };
const meanings = ['a', 'b'].map((id) => ({ id, wordId: 'w', partOfSpeech: 'v.',
  chineseMeaning: id, selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1 }));

describe('智能单词题型选择', () => {
  beforeEach(() => vi.resetAllMocks());
  it('新单词采用默认英译中题型', async () => {
    expect((await buildAdaptiveWordQuestion(word, meanings)).questionType).toBe('en-to-zh');
  });
  it('依据组内最需要练习的义项选择拼写题', async () => {
    vi.mocked(performanceRepository.getProfile).mockImplementation(async (id) => ({
      ...createEmptyPerformanceProfile(id), correctCount: 8,
      recognitionScore: 0.8, recallScore: 0.8, contextScore: 0.8,
      spellingScore: id === 'b' ? 0.1 : 0.8
    }));
    const question = await buildAdaptiveWordQuestion(word, meanings);
    expect(question.questionType).toBe('spelling');
    expect(question.meaningId).toBe('b');
  });
  it('语境题缺少例句时回退中译英，空组拒绝出题', async () => {
    vi.mocked(performanceRepository.getProfile).mockResolvedValue({
      ...createEmptyPerformanceProfile('a'), correctCount: 8, contextScore: 0.1
    });
    expect((await buildAdaptiveWordQuestion(word, meanings)).questionType).toBe('zh-to-en');
    await expect(buildAdaptiveWordQuestion(word, [])).rejects.toThrow();
  });
});
