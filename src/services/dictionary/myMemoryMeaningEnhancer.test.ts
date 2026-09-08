import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RawDictionaryMeaning } from './dictionaryProvider';
import { MyMemoryMeaningEnhancer } from './myMemoryMeaningEnhancer';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MyMemoryMeaningEnhancer', () => {
  it('相同英文 definition 不重复翻译', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: { translatedText: '收费' },
        responseStatus: 200
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const meanings: RawDictionaryMeaning[] = [
      {
        partOfSpeech: 'v.',
        chineseMeaning: '',
        englishDefinition: 'to ask someone to pay an amount of money'
      },
      {
        partOfSpeech: 'v.',
        chineseMeaning: '',
        englishDefinition: 'to ask someone to pay an amount of money'
      },
      {
        partOfSpeech: 'v.',
        chineseMeaning: '',
        englishDefinition: 'to accuse someone formally'
      }
    ];

    const enhancer = new MyMemoryMeaningEnhancer();
    const result = await enhancer.enhance('charge', meanings);

    expect(result).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('翻译失败时保留英文 definition', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({})
      })
    );

    const enhancer = new MyMemoryMeaningEnhancer();
    const result = await enhancer.enhance('charge', [
      {
        partOfSpeech: 'v.',
        chineseMeaning: '',
        englishDefinition: 'to rush forward'
      }
    ]);

    expect(result[0].chineseMeaning).toBe('to rush forward');
  });
});
