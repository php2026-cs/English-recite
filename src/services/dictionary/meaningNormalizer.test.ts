import { describe, expect, it } from 'vitest';
import {
  isLongChineseMeaning,
  normalizeChineseMeaning,
  normalizeEnhancedMeanings,
  splitChineseMeaningText
} from './meaningNormalizer';

describe('中文释义清洗', () => {
  it('trim 前后空格', () => {
    expect(normalizeChineseMeaning('  收费  ')).toBe('收费');
  });

  it('去除结尾中文标点', () => {
    expect(normalizeChineseMeaning('收费。')).toBe('收费');
    expect(normalizeChineseMeaning('收费；')).toBe('收费');
    expect(normalizeChineseMeaning('收费;')).toBe('收费');
  });

  it('去除安全前缀', () => {
    expect(normalizeChineseMeaning('意思是收费')).toBe('收费');
    expect(normalizeChineseMeaning('表示收费')).toBe('收费');
  });

  it('不错误拆分普通中文逗号', () => {
    const text = '对某人提出正式指控，控告其犯罪';
    expect(splitChineseMeaningText(text)).toEqual([text]);
  });

  it('分号形式的多个独立候选可以正确处理', () => {
    const result = normalizeEnhancedMeanings([
      {
        partOfSpeech: 'v.',
        chineseMeaning: '收费；收费；收取费用',
        translatedDefinition: '收费；收费；收取费用'
      }
    ]);
    expect(result.map((item) => item.chineseMeaning)).toEqual(['收费', '收取费用']);
  });

  it('长中文 definition 不会被粗暴字符串截断', () => {
    const text = '要求某人为商品或服务支付一定数量的钱';
    const result = normalizeEnhancedMeanings([
      {
        partOfSpeech: 'v.',
        chineseMeaning: text,
        translatedDefinition: text
      }
    ]);
    expect(result[0].chineseMeaning).toBe(text);
    expect(result[0].chineseMeaning.includes('...')).toBe(false);
    expect(isLongChineseMeaning(result[0].chineseMeaning)).toBe(true);
  });

  it('原始 definition 和 translatedDefinition 可以保留', () => {
    const result = normalizeEnhancedMeanings([
      {
        partOfSpeech: 'v.',
        chineseMeaning: '收费',
        englishDefinition: 'to ask someone to pay an amount of money',
        translatedDefinition: '要求某人为商品或服务支付一定金额'
      }
    ]);
    expect(result[0].englishDefinition).toBe('to ask someone to pay an amount of money');
    expect(result[0].translatedDefinition).toBe('要求某人为商品或服务支付一定金额');
  });
});
