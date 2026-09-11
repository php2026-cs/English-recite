import { readFileSync, writeFileSync } from 'node:fs';
const source = new URL('../src/data/lexicon/cet6.json', import.meta.url);
const output = new URL('../src/data/lexicon/aliases.json', import.meta.url);
const entries = JSON.parse(readFileSync(source, 'utf8'));
const aliases = Object.fromEntries(Object.entries(entries).map(([word, entry]) => [word,
  entry.senses.filter(sense => sense.aliases?.length).map(({partOfSpeech, chineseMeaning, aliases}) =>
    ({partOfSpeech, chineseMeaning, aliases}))
]).filter(([, senses]) => senses.length));
writeFileSync(output, JSON.stringify(aliases) + '\n');
