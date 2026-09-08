import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const lexiconPath = join(projectRoot, 'src', 'data', 'lexicon', 'cet6.json');
const unmatchedPath = join(projectRoot, 'reports', 'cet6-unmatched.json');
const expectedUnmatchedPath = join(__dirname, 'cet6-expected-unmatched.json');

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

    for (const sense of entry.senses) {
      senseCount += 1;
      if (!sense.id || seenSenseIds.has(sense.id)) {
        fail(`sense id 重复或缺失：${word}`);
      }
      seenSenseIds.add(sense.id);
      if (!sense.partOfSpeech?.trim()) {
        fail(`${word} 存在缺少词性的 sense`);
      }
      if (!sense.chineseMeaning?.trim()) {
        fail(`${word} 存在缺少中文主释义的 sense`);
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

  let unmatched = [];
  if (existsSync(unmatchedPath)) {
    try {
      unmatched = JSON.parse(readFileSync(unmatchedPath, 'utf8'));
    } catch {
      fail('unmatched 报告不是合法 JSON。');
    }
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
