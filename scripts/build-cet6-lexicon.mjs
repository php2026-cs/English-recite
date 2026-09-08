import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { source: process.env.ECDICT_SOURCE_DIR };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--source' && args[i + 1]) {
      options.source = args[i + 1];
      i += 1;
    }
  }
  return options;
}

function normalizeWord(word) {
  return word.trim().toLowerCase();
}

function normalizePartOfSpeech(value) {
  const normalized = value.trim().toLowerCase();
  if (['n.', 'noun'].includes(normalized)) return 'n.';
  if (['v.', 'vt.', 'vi.', 'verb', 'transitive verb', 'intransitive verb'].includes(normalized)) {
    return 'v.';
  }
  if (['adj.', 'adjective'].includes(normalized)) return 'adj.';
  if (['adv.', 'adverb'].includes(normalized)) return 'adv.';
  if (['prep.', 'preposition'].includes(normalized)) return 'prep.';
  if (['conj.', 'conjunction'].includes(normalized)) return 'conj.';
  if (['pron.', 'pronoun'].includes(normalized)) return 'pron.';
  if (['num.', 'numeral'].includes(normalized)) return 'num.';
  if (['interj.', 'interjection'].includes(normalized)) return 'interj.';
  if (normalized === 'phrase' || normalized === 'phrasal verb') return 'phrase';
  return 'other';
}

function parseTranslationEntry(rawTranslation) {
  const translation = rawTranslation.trim();
  if (!translation) return null;

  const match = translation.match(/^([a-z]+\.)\s*(.*)$/i);
  if (!match) {
    const cleaned = translation.replace(/^\[[^\]]+\]\s*/, '').trim();
    return cleaned
      ? { partOfSpeech: 'other', glossText: cleaned }
      : null;
  }

  return {
    partOfSpeech: normalizePartOfSpeech(match[1]),
    glossText: match[2].trim()
  };
}

function splitGlossText(text) {
  return text
    .split(/[；;\/\n，,、]+/)
    .map((part) => part.replace(/^\[[^\]]+\]\s*/, '').trim())
    .map((part) => part.replace(/[。；;，]+$/, ''))
    .filter(Boolean);
}

function dedupeSenses(senses) {
  const seen = new Set();
  const result = [];
  for (const sense of senses) {
    const key = `${sense.partOfSpeech}|${sense.chineseMeaning}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sense);
  }
  return result;
}

function buildAutoEntry(word, dictEntry, normalizedWord) {
  const senses = [];
  for (const rawTranslation of dictEntry.translation ?? []) {
    const parsed = parseTranslationEntry(rawTranslation);
    if (!parsed) continue;
    for (const gloss of splitGlossText(parsed.glossText)) {
      senses.push({
        partOfSpeech: parsed.partOfSpeech,
        chineseMeaning: gloss,
        order: senses.length + 1,
        reviewStatus: 'auto'
      });
    }
  }

  return {
    id: `lex:${normalizedWord}`,
    word: dictEntry.word || word,
    phonetic: dictEntry.phonetic || undefined,
    packs: ['cet6'],
    senses: dedupeSenses(senses).map((sense, index) => ({
      ...sense,
      id: `lex:${normalizedWord}:s${index + 1}`,
      order: index + 1
    }))
  };
}

function applyManualOverrides(entries, overrides) {
  for (const [word, override] of Object.entries(overrides)) {
    const normalized = normalizeWord(word);
    const senses = override.senses.map((sense, index) => ({
      id: `lex:${normalized}:s${index + 1}`,
      partOfSpeech: sense.partOfSpeech,
      chineseMeaning: sense.chineseMeaning,
      aliases: sense.aliases,
      englishDefinition: sense.englishDefinition,
      order: index + 1,
      reviewStatus: 'reviewed'
    }));
    entries[normalized] = {
      id: `lex:${normalized}`,
      word: override.word || word,
      phonetic: override.phonetic,
      packs: ['cet6'],
      senses
    };
  }
}

function loadJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const { source } = parseArgs();
  const sourceDir = source ? resolve(source) : join(projectRoot, 'tmp', 'endict');
  const vocabularyDir = join(sourceDir, 'vocabulary');
  const dictDir = join(sourceDir, 'dict');

  if (!existsSync(vocabularyDir) || !existsSync(dictDir)) {
    console.error(
      `未找到词典源目录：${sourceDir}\n请先克隆 ismartcoding/endict，或通过 ECDICT_SOURCE_DIR 指定目录。`
    );
    process.exit(1);
  }

  const cet4Words = loadJsonFile(join(vocabularyDir, 'cet4.json'));
  const cet6Words = loadJsonFile(join(vocabularyDir, 'cet6.json'));
  const targetWords = [...new Set([...cet4Words, ...cet6Words].map(normalizeWord))];

  const matched = new Map();
  const dictFiles = readdirSync(dictDir).filter((name) => name.endsWith('.json'));
  for (const file of dictFiles) {
    const content = readFileSync(join(dictDir, file), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const normalized = normalizeWord(entry.sw ?? entry.word ?? '');
      if (!normalized || !targetWords.includes(normalized)) continue;
      matched.set(normalized, entry);
    }
  }

  const entries = {};
  const unmatched = [];
  for (const word of targetWords) {
    const dictEntry = matched.get(word);
    if (!dictEntry) {
      unmatched.push(word);
      continue;
    }
    entries[word] = buildAutoEntry(word, dictEntry, word);
  }

  const overridePath = join(__dirname, 'cet6-manual-overrides.json');
  if (existsSync(overridePath)) {
    applyManualOverrides(entries, loadJsonFile(overridePath));
  }

  const lexiconDir = join(projectRoot, 'src', 'data', 'lexicon');
  const reportsDir = join(projectRoot, 'reports');
  mkdirSync(lexiconDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });

  writeFileSync(
    join(lexiconDir, 'cet6.json'),
    `${JSON.stringify(entries)}\n`,
    'utf8'
  );

  const report = createReport(targetWords, matched, entries, unmatched);
  writeFileSync(
    join(reportsDir, 'cet6-lexicon-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    join(reportsDir, 'cet6-unmatched.json'),
    `${JSON.stringify(unmatched, null, 2)}\n`,
    'utf8'
  );

  console.log(JSON.stringify(report, null, 2));
}

function createReport(targetWords, matched, entries, unmatched) {
  const lexiconEntries = Object.values(entries);
  const senses = lexiconEntries.flatMap((entry) => entry.senses);
  const entriesWithChinese = lexiconEntries.filter((entry) => entry.senses.length > 0);
  const polysemous = lexiconEntries.filter((entry) => entry.senses.length > 1);
  const autoSenses = senses.filter((sense) => sense.reviewStatus !== 'reviewed');
  const reviewedEntries = lexiconEntries.filter(
    (entry) => entry.senses.some((sense) => sense.reviewStatus === 'reviewed')
  );

  return {
    targetWordCount: targetWords.length,
    matchedWordCount: matched.size,
    unmatchedWordCount: unmatched.length,
    lexiconEntryCount: lexiconEntries.length,
    lexiconSenseCount: senses.length,
    entriesWithChineseCount: entriesWithChinese.length,
    entriesWithoutChineseCount: lexiconEntries.length - entriesWithChinese.length,
    singleSenseCount: lexiconEntries.length - polysemous.length,
    multiSenseCount: polysemous.length,
    autoSenseCount: autoSenses.length,
    reviewedEntryCount: reviewedEntries.length,
    unmatchedWords: unmatched
  };
}

main();
