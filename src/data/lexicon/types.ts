export interface LexiconSense {
  id: string;
  partOfSpeech: string;
  chineseMeaning: string;
  aliases?: string[];
  englishDefinition?: string;
  order: number;
  reviewStatus?: 'auto' | 'reviewed';
}

export interface LexiconEntry {
  id: string;
  word: string;
  phonetic?: string;
  packs: string[];
  frequency?: number;
  senses: LexiconSense[];
}

export type LexiconData = Record<string, LexiconEntry>;
