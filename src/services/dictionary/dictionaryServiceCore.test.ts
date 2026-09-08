import { describe, expect, it, vi } from 'vitest';
import { MemoryDictionaryCache, normalizeDictionaryWord } from './dictionaryCache';
import { DictionaryServiceCore } from './dictionaryServiceCore';
import type { MeaningEnhancer } from './meaningEnhancer';
import type { DictionaryLookupResult, DictionaryProvider } from './dictionaryProvider';

function createResult(word = 'charge'): DictionaryLookupResult {
  return {
    word,
    phonetic: '/tʃɑːrdʒ/',
    meanings: [
      {
        partOfSpeech: 'v.',
        chineseMeaning: '收费',
        englishDefinition: 'to ask someone to pay an amount of money',
        translatedDefinition: '要求某人为商品或服务支付一定金额'
      }
    ]
  };
}

function createService(overrides?: {
  provider?: DictionaryProvider;
  enhancer?: MeaningEnhancer;
  cache?: MemoryDictionaryCache;
}) {
  const cache = overrides?.cache ?? new MemoryDictionaryCache();
  const provider =
    overrides?.provider ?? { lookup: vi.fn().mockResolvedValue(createResult()) };
  const enhancer =
    overrides?.enhancer ??
    ({ enhance: vi.fn().mockImplementation(async (_word, meanings) => meanings) } as MeaningEnhancer);

  return {
    cache,
    provider,
    enhancer,
    service: new DictionaryServiceCore(provider, enhancer, cache)
  };
}

describe('dictionary cache', () => {
  it('normalizeWord(" Charge ") 返回 charge', () => {
    expect(normalizeDictionaryWord(' Charge ')).toBe('charge');
  });

  it('缓存大小写不敏感', async () => {
    const { service, cache, provider } = createService();
    await cache.set('charge', createResult());

    const result = await service.lookup('CHARGE');
    expect(result.fromCache).toBe(true);
    expect(provider.lookup).not.toHaveBeenCalled();
  });

  it('有缓存时不会调用 provider', async () => {
    const { service, cache, provider } = createService();
    await cache.set('charge', createResult());
    await service.lookup('charge');
    expect(provider.lookup).not.toHaveBeenCalled();
  });

  it('forceRefresh 会绕过缓存', async () => {
    const { service, cache, provider } = createService();
    await cache.set('charge', createResult());
    const result = await service.lookup('charge', { forceRefresh: true });
    expect(provider.lookup).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
  });

  it('forceRefresh 成功后更新缓存', async () => {
    const { service, cache, provider } = createService();
    const updated = createResult('charge');
    updated.meanings = [
      {
        partOfSpeech: 'v.',
        chineseMeaning: '冲锋',
        englishDefinition: 'to rush forward',
        translatedDefinition: '冲锋'
      }
    ];
    (provider.lookup as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    await service.lookup('charge', { forceRefresh: true });
    const cached = await cache.get('charge');
    expect(cached?.meanings[0].chineseMeaning).toBe('冲锋');
  });

  it('离线但有缓存时仍然返回结果', async () => {
    const provider: DictionaryProvider = {
      lookup: vi.fn().mockRejectedValue(new Error('network down'))
    };
    const { service, cache } = createService({ provider });
    await cache.set('charge', createResult());

    const result = await service.lookup('charge');
    expect(result.fromCache).toBe(true);
    expect(result.meanings[0].chineseMeaning).toBe('收费');
  });

  it('API 错误被转换成用户友好的错误状态', async () => {
    const provider: DictionaryProvider = {
      lookup: vi.fn().mockRejectedValue(new Error('HTTP 429'))
    };
    const { service } = createService({ provider });
    await expect(service.lookup('charge')).rejects.toThrow(
      '当前无法联网获取释义，你仍然可以手动添加。'
    );
  });
});
