import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PART_OF_SPEECH_VALUES, isReadableGloss } from './lexicon-rules.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
// --lexicon <path> 便于对临时副本验证规则本身是否真的生效。
const lexiconArgIndex = process.argv.indexOf('--lexicon');
const lexiconPath = lexiconArgIndex >= 0 && process.argv[lexiconArgIndex + 1]
  ? resolve(process.argv[lexiconArgIndex + 1])
  : join(projectRoot, 'src', 'data', 'lexicon', 'cet6.json');
const aliasesPath = join(projectRoot, 'src', 'data', 'lexicon', 'aliases.json');
// 未匹配词表随源码入库，保证全新克隆也能校验（此前只存在被忽略的 reports/ 里）。
const actualUnmatchedPath = join(__dirname, 'cet6-unmatched.json');
const expectedUnmatchedPath = join(__dirname, 'cet6-expected-unmatched.json');
const REVIEW_STATUS_VALUES = ['auto', 'reviewed'];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function main() {
  if (!existsSync(lexiconPath)) {
    fail(`缺少 ${lexiconPath}，请先运行 npm run lexicon:build`);
    return;
  }

  let entries;
  try {
    entries = JSON.parse(readFileSync(lexiconPath, 'utf8'));
  } catch {
    fail('静态词库 JSON 格式错误。');
    return;
  }

  const words = Object.keys(entries);
  const seenNormalized = new Set();
  const seenSenseIds = new Set();
  let senseCount = 0;
  let reviewedEntryCount = 0;

  for (const word of words) {
    const entry = entries[word];
    const normalized = word.trim().toLowerCase();
    if (normalized !== word) {
      fail(`词条 key 未归一化：${word}`);
    }
    if (seenNormalized.has(normalized)) {
      fail(`normalized word 重复：${normalized}`);
    }
    seenNormalized.add(normalized);

    if (!entry.id || typeof entry.id !== 'string') {
      fail(`${word} 缺少 id`);
    }
    if (!entry.word || typeof entry.word !== 'string') {
      fail(`${word} 缺少 word`);
    }
    if (!Array.isArray(entry.packs) || !entry.packs.includes('cet6')) {
      fail(`${word} 的 packs 未包含 cet6`);
    }
    if (!Array.isArray(entry.senses)) {
      fail(`${word} 的 senses 不是数组`);
      continue;
    }
    if (entry.senses.length === 0) {
      fail(`${word} 没有任何义项`);
    }
    // key 必须与 entry.word 大小写无关地一致，否则查词与展示会对不上。
    if (entry.word.trim().toLowerCase() !== normalized) {
      fail(`${word} 的 word 与 key 不一致：${entry.word}`);
    }

    for (const sense of entry.senses) {
      senseCount += 1;
      if (!sense.id || seenSenseIds.has(sense.id)) {
        fail(`sense id 重复或缺失：${word}`);
      }
      seenSenseIds.add(sense.id);
      if (!sense.partOfSpeech?.trim()) {
        fail(`${word} 存在缺少词性的 sense`);
      } else if (!PART_OF_SPEECH_VALUES.includes(sense.partOfSpeech)) {
        fail(`${word} 存在未知词性：${sense.partOfSpeech}`);
      }
      if (!sense.chineseMeaning?.trim()) {
        fail(`${word} 存在缺少中文主释义的 sense`);
      } else if (!isReadableGloss(sense.chineseMeaning)) {
        fail(`${word} 存在无法阅读的释义：${JSON.stringify(sense.chineseMeaning)}`);
      }
      if (sense.reviewStatus !== undefined && !REVIEW_STATUS_VALUES.includes(sense.reviewStatus)) {
        fail(`${word} 存在未知 reviewStatus：${JSON.stringify(sense.reviewStatus)}`);
      }
      if (Array.isArray(sense.aliases)) {
        const uniqueAliases = new Set(sense.aliases.filter(Boolean));
        if (uniqueAliases.size !== sense.aliases.filter(Boolean).length) {
          fail(`${word} 存在重复 alias`);
        }
      }
      if (sense.reviewStatus === 'reviewed') {
        reviewedEntryCount += 1;
      }
    }
  }

  // 反向检查：aliases.json 不应残留 cet6.json 里已经不存在的词条。
  if (existsSync(aliasesPath)) {
    const aliases = JSON.parse(readFileSync(aliasesPath, 'utf8'));
    for (const word of Object.keys(aliases)) {
      if (!Object.prototype.hasOwnProperty.call(entries, word)) {
        fail(`aliases.json 残留了词典中不存在的词条：${word}`);
      }
    }
  }

  let unmatched = [];
  if (existsSync(actualUnmatchedPath)) {
    try {
      unmatched = JSON.parse(readFileSync(actualUnmatchedPath, 'utf8'));
    } catch {
      fail('未匹配词表不是合法 JSON。');
    }
  } else {
    fail(`缺少 ${actualUnmatchedPath}，请先运行 npm run lexicon:build`);
  }
  const expectedUnmatched = JSON.parse(readFileSync(expectedUnmatchedPath, 'utf8'));
  const missingFromExpected = expectedUnmatched.filter((word) => !unmatched.includes(word));
  const unexpectedUnmatched = unmatched.filter((word) => !expectedUnmatched.includes(word));
  if (missingFromExpected.length > 0 || unexpectedUnmatched.length > 0) {
    fail(
      `未匹配词表与预期不一致。缺少：${JSON.stringify(
        missingFromExpected
      )}；多余：${JSON.stringify(unexpectedUnmatched)}`
    );
  }

  console.log(
    JSON.stringify(
      {
        lexiconEntryCount: words.length,
        senseCount,
        reviewedSenseCount: reviewedEntryCount,
        unmatchedWordCount: unmatched.length,
        valid: process.exitCode === undefined ? true : process.exitCode === 0
      },
      null,
      2
    )
  );
}

main();
