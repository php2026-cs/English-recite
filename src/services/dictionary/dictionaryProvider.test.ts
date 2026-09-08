import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCandidateMeaning } from './candidates';
import { DictionaryApiProvider } from './dictionaryApiProvider';
import {
  deduplicateLookupMeanings,
  normalizePartOfSpeech
} from './dictionaryProvider';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('词典词性标准化', () => {
  it('noun 正确标准化成 n.', () => {
    expect(normalizePartOfSpeech('noun')).toBe('n.');
  });

  it('verb 正确标准化成 v.', () => {
    expect(normalizePartOfSpeech('verb')).toBe('v.');
  });

  it('未知词性保持原样并去除首尾空格', () => {
    expect(normalizePartOfSpeech('  phrasal verb  ')).toBe('phrase');
  });
});

describe('候选释义去重', () => {
  it('完全重复的候选释义会去重', () => {
    const result = deduplicateLookupMeanings([
      { partOfSpeech: 'verb', chineseMeaning: '收费' },
      { partOfSpeech: 'v.', chineseMeaning: '收费' },
      { partOfSpeech: 'v.', chineseMeaning: '收费' }
    ]);
    expect(result).toEqual([{ partOfSpeech: 'v.', chineseMeaning: '收费' }]);
  });

  it('同中文释义但不同词性不会错误去重', () => {
    const result = deduplicateLookupMeanings([
      { partOfSpeech: 'v.', chineseMeaning: '指控' },
      { partOfSpeech: 'n.', chineseMeaning: '指控' }
    ]);
    expect(result).toHaveLength(2);
  });
});

describe('词典请求失败降级', () => {
  it('API 请求失败会抛出错误而不是让页面崩溃', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const provider = new DictionaryApiProvider();
    await expect(provider.lookup('charge')).rejects.toThrow('network down');
  });

  it('API 失败后仍然可以手动创建候选 Meaning', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const provider = new DictionaryApiProvider();
    await expect(provider.lookup('charge')).rejects.toThrow('network down');

    const manual = createCandidateMeaning(
      { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: true },
      'manual'
    );
    expect(manual).toMatchObject({
      partOfSpeech: 'v.',
      chineseMeaning: '收费',
      selectedForStudy: true
    });
  });
});
