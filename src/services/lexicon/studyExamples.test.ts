import { describe, expect, it } from 'vitest';
import { findStudyExample, isFirstStudy } from './studyExamples';
import { studyExamples } from '../../data/lexicon/studyExamples';
import overrides from '../../../scripts/cet6-manual-overrides.json';
import type { Meaning, MeaningReviewState } from '../../types';

const meaning: Meaning = { id: 'm', wordId: 'w', partOfSpeech: 'v.', chineseMeaning: '指控',
  correctCount: 0, incorrectCount: 0, selectedForStudy: true, createdAt: 1, updatedAt: 1 };

describe('义项学习例句', () => {
  it('已校对的多义词每个标准义项都有双语学习例句', () => {
    for (const [word, entry] of Object.entries(overrides)) {
      for (const sense of entry.senses) {
        const example = findStudyExample(word, { ...meaning, ...sense });
        expect(example?.english, `${word} / ${sense.partOfSpeech} / ${sense.chineseMeaning}`).toBeTruthy();
        expect(example?.chinese).toBeTruthy();
      }
    }
  });
  it('区分相同中文的名词和动词，别名可回到同一义项', () => {
    expect(findStudyExample(' CHARGE ', meaning)?.english).toContain('charged');
    expect(findStudyExample('charge', { ...meaning, partOfSpeech: 'n.' })?.english).toContain('charge of theft');
    expect(findStudyExample('charge', { ...meaning, chineseMeaning: '控告' })).toEqual(findStudyExample('charge', meaning));
    expect(findStudyExample('charge', { ...meaning, chineseMeaning: '香蕉' })).toBeUndefined();
  });
  it('首学自动展开；已有本地学习记录或同步 FSRS 状态时折叠', () => {
    expect(isFirstStudy(meaning)).toBe(true);
    expect(isFirstStudy({ ...meaning, lastReviewedAt: 1 })).toBe(false);
    expect(isFirstStudy({ ...meaning, incorrectCount: 1 })).toBe(false);
    const state: MeaningReviewState = { meaningId: 'm', state: 'learning', dueAt: 2,
      reps: 1, lapses: 0, createdAt: 1, updatedAt: 1 };
    expect(isFirstStudy(meaning, state)).toBe(false);
  });
  it('例句库不存在空句或不带词性的键', () => {
    for (const entries of Object.values(studyExamples)) {
      for (const [key, example] of Object.entries(entries)) {
        expect(key.split('|')).toHaveLength(2);
        expect(example.english.trim()).not.toBe('');
        expect(example.chinese.trim()).not.toBe('');
      }
    }
  });
});
