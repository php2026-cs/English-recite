import { describe, expect, it } from 'vitest';
import { normalizeEnglish } from '../../lib/strings';
import type { Meaning } from '../../types';
import {
  candidateKey,
  createCandidateMeaning,
  deduplicateCandidates,
  filterMissingCandidates,
  removeCandidateMeaning,
  shouldFillPhonetic,
  toMeaningInput,
  toggleCandidateMeaning,
  updateCandidateMeaning
} from './candidates';

describe('候选释义编辑', () => {
  it('自动候选可以修改中文释义和词性', () => {
    const candidate = createCandidateMeaning(
      { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: false },
      'dictionary'
    );
    const updated = updateCandidateMeaning([candidate], candidate.id, {
      partOfSpeech: 'n.',
      chineseMeaning: '费用',
      selectedForStudy: true
    });
    expect(updated[0]).toMatchObject({
      partOfSpeech: 'n.',
      chineseMeaning: '费用',
      selectedForStudy: true
    });
  });

  it('自动候选可以删除', () => {
    const candidate = createCandidateMeaning(
      { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: false },
      'dictionary'
    );
    expect(removeCandidateMeaning([candidate], candidate.id)).toHaveLength(0);
  });

  it('自动候选可以取消 selectedForStudy', () => {
    const candidate = createCandidateMeaning(
      { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: true },
      'dictionary'
    );
    const toggled = toggleCandidateMeaning([candidate], candidate.id);
    expect(toggled[0].selectedForStudy).toBe(false);
  });

  it('用户仍然可以手动添加 Meaning 候选', () => {
    const candidate = createCandidateMeaning(
      { partOfSpeech: 'phrasal verb', chineseMeaning: '负责', selectedForStudy: true },
      'manual'
    );
    expect(candidate).toMatchObject({
      partOfSpeech: 'phrasal verb',
      chineseMeaning: '负责',
      selectedForStudy: true,
      source: 'manual'
    });
  });
});

describe('已有单词补充释义', () => {
  const existing: Array<Pick<Meaning, 'partOfSpeech' | 'chineseMeaning'>> = [
    { partOfSpeech: 'v.', chineseMeaning: '收费' },
    { partOfSpeech: 'v.', chineseMeaning: '指控' }
  ];

  it('不会重复添加已有 Meaning', () => {
    const fetched = [
      createCandidateMeaning(
        { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: false },
        'dictionary'
      ),
      createCandidateMeaning(
        { partOfSpeech: 'v.', chineseMeaning: '冲锋', selectedForStudy: false },
        'dictionary'
      )
    ];
    const missing = filterMissingCandidates(existing, fetched);
    expect(missing.map((item) => item.chineseMeaning)).toEqual(['冲锋']);
  });

  it('不会覆盖用户已经修改的 Meaning', () => {
    const original = [...existing];
    const fetched = [
      createCandidateMeaning(
        { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: false },
        'dictionary'
      )
    ];
    filterMissingCandidates(existing, fetched);
    expect(existing).toEqual(original);
  });

  it('不会覆盖用户手动设置的 phonetic', () => {
    expect(shouldFillPhonetic('/tʃɑːrdʒ/', '/tʃɑrdʒ/')).toBe(false);
    expect(shouldFillPhonetic('', '/tʃɑrdʒ/')).toBe(true);
  });
});

describe('单词大小写归一化', () => {
  it('Charge 和 charge 被识别为同一个 Word', () => {
    expect(normalizeEnglish('Charge')).toBe(normalizeEnglish('charge'));
    expect(normalizeEnglish(' CHARGE ')).toBe('charge');
  });

  it('不同词性同中文不会错误去重', () => {
    const candidates = [
      createCandidateMeaning(
        { partOfSpeech: 'v.', chineseMeaning: '指控', selectedForStudy: false },
        'dictionary'
      ),
      createCandidateMeaning(
        { partOfSpeech: 'n.', chineseMeaning: '指控', selectedForStudy: false },
        'dictionary'
      )
    ];
    expect(deduplicateCandidates(candidates)).toHaveLength(2);
    expect(candidateKey('v.', '指控')).not.toBe(candidateKey('n.', '指控'));
  });
});

describe('候选转正式 Meaning', () => {
  it('最终保存 Meaning 时不会把辅助字段写入正式数据', () => {
    const candidate = createCandidateMeaning(
      { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: true },
      'dictionary',
      {
        sourceDefinition: 'to ask someone to pay an amount of money',
        translatedDefinition: '要求某人为商品或服务支付一定金额'
      }
    );

    expect(toMeaningInput(candidate)).toEqual({
      partOfSpeech: 'v.',
      chineseMeaning: '收费',
      selectedForStudy: true
    });
  });

  it('selectedForStudy = false 仍然可以正常保存', () => {
    const candidate = createCandidateMeaning(
      { partOfSpeech: 'n.', chineseMeaning: '电荷', selectedForStudy: false },
      'dictionary'
    );
    expect(toMeaningInput(candidate).selectedForStudy).toBe(false);
  });

  it('重复点击不会产生重复候选', () => {
    const first = createCandidateMeaning(
      { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: false },
      'dictionary'
    );
    const second = createCandidateMeaning(
      { partOfSpeech: 'v.', chineseMeaning: '收费', selectedForStudy: false },
      'dictionary'
    );
    expect(deduplicateCandidates([first, second])).toHaveLength(1);
  });
});
