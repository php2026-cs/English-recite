import { describe, expect, it } from 'vitest';
import { splitHighlightedExample } from './exampleHighlight';
import { studyExamples } from '../data/lexicon/studyExamples';

const highlighted = (sentence: string, word: string) => splitHighlightedExample(sentence, word)
  .filter((part) => part.highlighted).map((part) => part.text);

describe('例句目标词高亮', () => {
  it('识别大小写及常见规则词形，保留原文字和标点', () => {
    const sentence = 'Charge, charges, charged: charging!';
    expect(highlighted(sentence, 'charge')).toEqual(['Charge', 'charges', 'charged', 'charging']);
    expect(splitHighlightedExample(sentence, 'charge').map((part) => part.text).join('')).toBe(sentence);
  });
  it('识别不规则过去式和分词，不标无关词', () => {
    expect(highlighted('She ran while he was running past a runner.', 'run')).toEqual(['ran', 'running']);
    expect(highlighted('He took the book; it had been taken.', 'take')).toEqual(['took', 'taken']);
    expect(highlighted('The clock struck twelve.', 'strike')).toEqual(['struck']);
  });
  it('不做子串匹配，支持短语及空目标', () => {
    expect(highlighted('Define a finer line, then pay the fine.', 'fine')).toEqual(['fine']);
    expect(highlighted('Look up the word in a lookup table.', 'look up')).toEqual(['Look up']);
    expect(highlighted('Keep all this text.', '')).toEqual([]);
  });
  it('已有 80 个义项的所有例句都能标出目标词，并完整保留文本', () => {
    for (const [word, examples] of Object.entries(studyExamples)) {
      for (const example of Object.values(examples)) {
        const parts = splitHighlightedExample(example.english, word);
        expect(parts.some((part) => part.highlighted), `${word}: ${example.english}`).toBe(true);
        expect(parts.map((part) => part.text).join('')).toBe(example.english);
      }
    }
  });
});
