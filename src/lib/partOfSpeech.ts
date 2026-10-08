// 词性在界面上的中文名。词典里仍有约一万条义项的词性未识别（源的 a. 等缩写
// 此前未被映射），因此这里必须给出可读的兜底名称，而不是把 "other" 直接显示给学习者。
export const PART_OF_SPEECH_LABELS: Record<string, string> = {
  'n.': '名词',
  'v.': '动词',
  'adj.': '形容词',
  'adv.': '副词',
  'prep.': '介词',
  'conj.': '连词',
  'pron.': '代词',
  'num.': '数词',
  'interj.': '感叹词',
  'art.': '冠词',
  'aux.': '助动词',
  'abbr.': '缩写',
  phrase: '短语',
  other: '其他词性'
};

export function partOfSpeechLabel(value: string | undefined): string {
  const key = (value ?? '').trim();
  if (!key) return PART_OF_SPEECH_LABELS.other;
  return PART_OF_SPEECH_LABELS[key] ?? key;
}
