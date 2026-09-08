const CHINESE_PUNCTUATION = /[，。；：！？、“”‘’（）《》【】,.!?;:()\s]/g;

export function normalizeChinese(input: string): string {
  return input.trim().replace(CHINESE_PUNCTUATION, '');
}

export function normalizeEnglish(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isMeaningMatch(candidate: string, storedChineseMeaning: string): boolean {
  if (!candidate.trim() || !storedChineseMeaning.trim()) {
    return false;
  }
  return (
    normalizeChinese(candidate) === normalizeChinese(storedChineseMeaning) ||
    candidate.trim() === storedChineseMeaning.trim()
  );
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
