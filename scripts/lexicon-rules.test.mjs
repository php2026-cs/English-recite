import { describe, expect, it } from 'vitest';
import {
  applyLexiconHygiene,
  isReadableGloss,
  normalizePartOfSpeech,
  PART_OF_SPEECH_VALUES
} from './lexicon-rules.mjs';

describe('词典词性归一化', () => {
  it('ECDICT 的 a. 与 ad. 分别映射到形容词和副词', () => {
    // a. 此前未映射，是 30% 义项落到 other 的原因。
    expect(normalizePartOfSpeech('a.')).toBe('adj.');
    expect(normalizePartOfSpeech('ad.')).toBe('adv.');
    expect(normalizePartOfSpeech('adj.')).toBe('adj.');
    expect(normalizePartOfSpeech('adv.')).toBe('adv.');
  });

  it('覆盖其余常见缩写', () => {
    expect(normalizePartOfSpeech('vt.')).toBe('v.');
    expect(normalizePartOfSpeech('vi.')).toBe('v.');
    expect(normalizePartOfSpeech('art.')).toBe('art.');
    expect(normalizePartOfSpeech('int.')).toBe('interj.');
    expect(normalizePartOfSpeech('aux.')).toBe('aux.');
    expect(normalizePartOfSpeech('abbr.')).toBe('abbr.');
    expect(normalizePartOfSpeech('phrasal verb')).toBe('phrase');
    expect(normalizePartOfSpeech('Adjective')).toBe('adj.');
  });

  it('无法识别与空值回退到 other，不猜测', () => {
    expect(normalizePartOfSpeech('')).toBe('other');
    expect(normalizePartOfSpeech(undefined)).toBe('other');
    expect(normalizePartOfSpeech('bogus')).toBe('other');
  });

  it('所有返回值都在取值集合内', () => {
    for (const value of ['n.', 'v.', 'a.', 'ad.', 'art.', 'int.', 'aux.', 'abbr.', 'x', '']) {
      expect(PART_OF_SPEECH_VALUES).toContain(normalizePartOfSpeech(value));
    }
  });
});

describe('词典清洗规则', () => {
  function entry(word, senses) {
    return {
      id: `lex:${word}`,
      word,
      packs: ['cet6'],
      senses: senses.map((sense, index) => ({ ...sense, id: `lex:${word}:s${index + 1}`, order: index + 1 }))
    };
  }

  it('丢弃既无中文也无拉丁字母的释义', () => {
    expect(isReadableGloss('Г')).toBe(false);
    expect(isReadableGloss('铝Al')).toBe(true);
    expect(isReadableGloss('OK')).toBe(true);
    const entries = { ounce: entry('ounce', [
      { partOfSpeech: 'n.', chineseMeaning: '盎司' },
      { partOfSpeech: 'other', chineseMeaning: 'Г' }
    ]) };
    const stats = applyLexiconHygiene(entries);
    expect(stats.removedUnreadableGloss).toBe(1);
    expect(entries.ounce.senses.map((sense) => sense.chineseMeaning)).toEqual(['盎司']);
  });

  it('删除与同词其他词性重复的 other 义项', () => {
    const entries = { ability: entry('ability', [
      { partOfSpeech: 'n.', chineseMeaning: '能力' },
      { partOfSpeech: 'other', chineseMeaning: '能力' },
      { partOfSpeech: 'other', chineseMeaning: '本领' }
    ]) };
    const stats = applyLexiconHygiene(entries);
    expect(stats.removedRedundantOther).toBe(1);
    expect(entries.ability.senses.map((sense) => sense.chineseMeaning)).toEqual(['能力', '本领']);
  });

  it('不删除同词性内或其他词性独有的义项', () => {
    const entries = { abstract: entry('abstract', [
      { partOfSpeech: 'n.', chineseMeaning: '摘要' },
      { partOfSpeech: 'v.', chineseMeaning: '摘要' },
      { partOfSpeech: 'other', chineseMeaning: '抽象派作品' }
    ]) };
    const stats = applyLexiconHygiene(entries);
    expect(stats.removedRedundantOther).toBe(0);
    expect(entries.abstract.senses).toHaveLength(3);
  });

  it('清理后重排 id 与 order，未改动条目保持原编号', () => {
    const entries = {
      keep: entry('keep', [
        { partOfSpeech: 'n.', chineseMeaning: '甲' },
        { partOfSpeech: 'v.', chineseMeaning: '乙' }
      ]),
      drop: entry('drop', [
        { partOfSpeech: 'n.', chineseMeaning: '甲' },
        { partOfSpeech: 'other', chineseMeaning: '甲' },
        { partOfSpeech: 'v.', chineseMeaning: '乙' }
      ])
    };
    applyLexiconHygiene(entries);
    expect(entries.keep.senses.map((sense) => sense.id)).toEqual(['lex:keep:s1', 'lex:keep:s2']);
    expect(entries.drop.senses.map((sense) => sense.id)).toEqual(['lex:drop:s1', 'lex:drop:s2']);
    expect(entries.drop.senses.map((sense) => sense.order)).toEqual([1, 2]);
  });

  it('把音标里的西里尔字母 ә 换成 ə', () => {
    const entries = { analyze: { ...entry('analyze', [{ partOfSpeech: 'v.', chineseMeaning: '分析' }]),
      phonetic: "'ænәlaiz" } };
    const stats = applyLexiconHygiene(entries);
    expect(stats.fixedPhonetic).toBe(1);
    expect(entries.analyze.phonetic).toBe("'ænəlaiz");
  });

  it('同形异码的其它西里尔字母也一并替换', () => {
    const entries = { tear: { ...entry('tear', [{ partOfSpeech: 'v.', chineseMeaning: '撕裂' }]),
      phonetic: 'tiə. tєə' } };
    applyLexiconHygiene(entries);
    expect(entries.tear.phonetic).toBe('tiə. teə');
  });

  it('不把没有实际变化的音标计入修复数量', () => {
    const entries = { keep: { ...entry('keep', [{ partOfSpeech: 'v.', chineseMeaning: '保持' }]),
      phonetic: 'kiːp' } };
    expect(applyLexiconHygiene(entries).fixedPhonetic).toBe(0);
  });

  it('可重复执行且结果稳定', () => {
    const build = () => ({ ability: entry('ability', [
      { partOfSpeech: 'n.', chineseMeaning: '能力' },
      { partOfSpeech: 'other', chineseMeaning: '能力' }
    ]) });
    const once = build();
    applyLexiconHygiene(once);
    const twice = build();
    applyLexiconHygiene(twice);
    const secondPassStats = applyLexiconHygiene(twice);
    expect(secondPassStats.removedRedundantOther).toBe(0);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('报告被清空的条目', () => {
    const entries = { junk: entry('junk', [{ partOfSpeech: 'other', chineseMeaning: 'Г' }]) };
    const stats = applyLexiconHygiene(entries);
    expect(stats.emptiedEntries).toEqual(['junk']);
  });
});
