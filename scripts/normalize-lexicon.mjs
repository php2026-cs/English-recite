// 就地清洗静态词典，不需要 endict 源目录。
// 与构建脚本共用 scripts/lexicon-rules.mjs，因此重新生成时会得到同样结果。
// 用法：node scripts/normalize-lexicon.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLexiconHygiene } from './lexicon-rules.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lexiconPath = join(resolve(__dirname, '..'), 'src', 'data', 'lexicon', 'cet6.json');
const checkOnly = process.argv.includes('--check');

const before = readFileSync(lexiconPath, 'utf8');
const entries = JSON.parse(before);
const senseCountBefore = Object.values(entries).reduce((sum, entry) => sum + entry.senses.length, 0);

const stats = applyLexiconHygiene(entries);

const senseCountAfter = Object.values(entries).reduce((sum, entry) => sum + entry.senses.length, 0);
const next = `${JSON.stringify(entries)}\n`;

if (stats.emptiedEntries.length > 0) {
  console.error(`清洗后出现无释义词条：${JSON.stringify(stats.emptiedEntries)}`);
  process.exit(1);
}

const summary = {
  lexiconEntryCount: Object.keys(entries).length,
  senseCountBefore,
  senseCountAfter,
  ...stats,
  emptiedEntries: undefined,
  changed: next !== before
};

if (checkOnly) {
  console.log(JSON.stringify({ ...summary, mode: 'check' }, null, 2));
  process.exitCode = summary.changed ? 1 : 0;
} else {
  writeFileSync(lexiconPath, next, 'utf8');
  console.log(JSON.stringify({ ...summary, mode: 'write' }, null, 2));
}
