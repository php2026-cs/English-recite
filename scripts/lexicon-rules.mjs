// 词典构建与清洗共用的确定性规则。构建脚本与原地清洗脚本都调用这里，
// 保证「重新生成」和「就地修正」得到同一份结果。
// 这些规则只做可证明安全的处理，不猜测词性。

// 与 src/types.ts 的 PART_OF_SPEECH_OPTIONS、界面 POS_NAMES 保持一致的取值集合。
export const PART_OF_SPEECH_VALUES = [
  'n.',
  'v.',
  'adj.',
  'adv.',
  'prep.',
  'conj.',
  'pron.',
  'num.',
  'interj.',
  'art.',
  'aux.',
  'abbr.',
  'phrase',
  'other'
];

const PART_OF_SPEECH_ALIASES = new Map([
  ['n.', 'n.'],
  ['noun', 'n.'],
  ['v.', 'v.'],
  ['vt.', 'v.'],
  ['vi.', 'v.'],
  ['verb', 'v.'],
  ['transitive verb', 'v.'],
  ['intransitive verb', 'v.'],
  ['adj.', 'adj.'],
  // ECDICT 用 a. 表示形容词；此前未映射，导致大量形容词落到 other。
  ['a.', 'adj.'],
  ['adjective', 'adj.'],
  ['adv.', 'adv.'],
  ['ad.', 'adv.'],
  ['adverb', 'adv.'],
  ['prep.', 'prep.'],
  ['preposition', 'prep.'],
  ['conj.', 'conj.'],
  ['conjunction', 'conj.'],
  ['pron.', 'pron.'],
  ['pronoun', 'pron.'],
  ['num.', 'num.'],
  ['numeral', 'num.'],
  ['interj.', 'interj.'],
  ['int.', 'interj.'],
  ['interjection', 'interj.'],
  ['art.', 'art.'],
  ['article', 'art.'],
  ['aux.', 'aux.'],
  ['auxiliary', 'aux.'],
  ['auxiliary verb', 'aux.'],
  ['abbr.', 'abbr.'],
  ['abbreviation', 'abbr.'],
  ['phrase', 'phrase'],
  ['phrasal verb', 'phrase']
]);

export function normalizePartOfSpeech(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return PART_OF_SPEECH_ALIASES.get(normalized) ?? 'other';
}

const CJK = /[\u3400-\u9fff]/;
const LATIN = /[a-z]/i;
const CYRILLIC = /[\u0400-\u04ff]/;
// 音标里出现西里尔字母一律是源数据里的同形异码错误，替换成对应的拉丁/国际音标字符。
const PHONETIC_HOMOGLYPHS = new Map([
  ['\u04d9', '\u0259'], // ә -> ə
  ['\u0454', 'e'], // є -> e
  ['\u0430', 'a'], // а -> a
  ['\u0435', 'e'], // е -> e
  ['\u043e', 'o'], // о -> o
  ['\u0440', 'p'], // р -> p
  ['\u0441', 'c'], // с -> c
  ['\u0445', 'x'], // х -> x
  ['\u0443', 'y'], // у -> y
  ['\u0456', 'i'], // і -> i
  ['\u0455', 's'], // ѕ -> s
  ['\u0458', 'j'] // ј -> j
]);
const HOMOGLYPH_PATTERN = new RegExp(`[${[...PHONETIC_HOMOGLYPHS.keys()].join('')}]`, 'g');

// 学习者至少得能读出这条释义：既没有中文也没有拉丁字母的释义（例如 "Г"）直接丢弃。
export function isReadableGloss(gloss) {
  return CJK.test(gloss) || LATIN.test(gloss);
}

export function applyLexiconHygiene(entries) {
  const stats = {
    removedUnreadableGloss: 0,
    removedRedundantOther: 0,
    fixedPhonetic: 0,
    emptiedEntries: []
  };

  for (const [word, entry] of Object.entries(entries)) {
    const glossesByPartOfSpeech = new Map();
    for (const sense of entry.senses) {
      if (!glossesByPartOfSpeech.has(sense.partOfSpeech)) {
        glossesByPartOfSpeech.set(sense.partOfSpeech, new Set());
      }
      glossesByPartOfSpeech.get(sense.partOfSpeech).add(sense.chineseMeaning);
    }

    const kept = entry.senses.filter((sense) => {
      if (!isReadableGloss(sense.chineseMeaning)) {
        stats.removedUnreadableGloss += 1;
        return false;
      }
      // 同一个词里 other 与已定词性的释义完全相同时，other 只是重复项。
      // 只在词性未识别、且同词另一词性已有同一释义时删除，不影响真正的多义词。
      if (sense.partOfSpeech === 'other') {
        for (const [partOfSpeech, glosses] of glossesByPartOfSpeech) {
          if (partOfSpeech !== 'other' && glosses.has(sense.chineseMeaning)) {
            stats.removedRedundantOther += 1;
            return false;
          }
        }
      }
      return true;
    });

    if (entry.phonetic && CYRILLIC.test(entry.phonetic)) {
      const fixed = entry.phonetic.replace(HOMOGLYPH_PATTERN, (char) => PHONETIC_HOMOGLYPHS.get(char));
      if (fixed !== entry.phonetic) {
        entry.phonetic = fixed;
        stats.fixedPhonetic += 1;
      }
    }

    entry.senses = kept.map((sense, index) => ({
      ...sense,
      id: `${entry.id}:s${index + 1}`,
      order: index + 1
    }));
    if (entry.senses.length === 0) stats.emptiedEntries.push(word);
  }

  return stats;
}
