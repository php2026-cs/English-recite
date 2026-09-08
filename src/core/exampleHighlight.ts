// Whole-word matching only. Inflections do not match unrelated words that merely
// contain the same letters (e.g. run / brunch, fine / define).
const IRREGULAR: Record<string, string[]> = {
  run: ['ran', 'running'], take: ['took', 'taken', 'taking'], hold: ['held'],
  draw: ['drew', 'drawn'], mean: ['meant'], strike: ['struck', 'stricken', 'striking'],
  bear: ['bore', 'born', 'borne'], spring: ['sprang', 'sprung'],
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'], have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'], go: ['goes', 'went', 'gone', 'going'],
  get: ['got', 'gotten', 'getting'], make: ['made', 'making'], say: ['said'],
  see: ['saw', 'seen'], come: ['came', 'coming'], give: ['gave', 'given', 'giving'],
  write: ['wrote', 'written', 'writing'], read: ['read'], think: ['thought'],
  buy: ['bought'], bring: ['brought'], teach: ['taught'], catch: ['caught'],
  leave: ['left', 'leaving'], feel: ['felt'], find: ['found'], keep: ['kept'],
  know: ['knew', 'known'], grow: ['grew', 'grown'], fall: ['fell', 'fallen'],
  speak: ['spoke', 'spoken'], break: ['broke', 'broken', 'breaking'],
  choose: ['chose', 'chosen', 'choosing'], child: ['children'], person: ['people'],
  man: ['men'], woman: ['women'], foot: ['feet'], tooth: ['teeth'], mouse: ['mice']
};

export function targetWordForms(word: string): Set<string> {
  const base = word.trim().toLowerCase();
  const forms = new Set([base, ...(IRREGULAR[base] ?? [])]);
  if (!/^[a-z]+$/.test(base)) return forms;
  forms.add(/[^aeiou]y$/.test(base) ? base.slice(0, -1) + 'ies' : /(?:s|sh|ch|x|z|o)$/.test(base) ? base + 'es' : base + 's');
  forms.add(base.endsWith('e') ? base + 'd' : /[^aeiou]y$/.test(base) ? base.slice(0, -1) + 'ied' : base + 'ed');
  forms.add(base.endsWith('ie') ? base.slice(0, -2) + 'ying' : /[^e]e$/.test(base) ? base.slice(0, -1) + 'ing' : base + 'ing');
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(base)) {
    forms.add(base + base[base.length - 1] + 'ing');
    forms.add(base + base[base.length - 1] + 'ed');
  }
  return forms;
}

export function splitHighlightedExample(sentence: string, target: string): Array<{ text: string; highlighted: boolean }> {
  const forms = targetWordForms(target);
  // Include spaces in phrase targets while keeping punctuation and text intact.
  const pattern = [...forms].filter(Boolean).sort((a, b) => b.length - a.length)
    .map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!pattern) return [{ text: sentence, highlighted: false }];
  const regex = new RegExp(`(?<![A-Za-z])(?:${pattern})(?![A-Za-z])`, 'gi');
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let index = 0;
  for (const match of sentence.matchAll(regex)) {
    const start = match.index!;
    if (start > index) parts.push({ text: sentence.slice(index, start), highlighted: false });
    parts.push({ text: match[0], highlighted: true });
    index = start + match[0].length;
  }
  if (index < sentence.length) parts.push({ text: sentence.slice(index), highlighted: false });
  return parts;
}
