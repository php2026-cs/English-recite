import { describe, expect, it } from 'vitest';
import {
  lexiconEntryToCandidates,
  lexiconSenseToCandidate,
  localLexicon,
  normalizeLexiconWord,
  resolveCandidatesFromLocalFirst
} from './localLexicon';

describe('local CET6 lexicon', () => {
  it('可以查询 CET6 单词', () => {
    expect(localLexicon.lookup('charge')).toBeDefined();
    expect(localLexicon.lookup('abnormal')).toBeDefined();
  });

  it('大小写查询一致', () => {
    expect(localLexicon.lookup('Charge')).toEqual(localLexicon.lookup('charge'));
  });

  it('不同词性的相同中文不会合并', () => {
    const entry = localLexicon.lookup('charge');
    expect(entry).toBeDefined();
    const verbAccusation = entry?.senses.find(
      (sense) => sense.partOfSpeech === 'v.' && sense.chineseMeaning === '指控'
    );
    const nounAccusation = entry?.senses.find(
      (sense) => sense.partOfSpeech === 'n.' && sense.chineseMeaning === '指控'
    );
    expect(verbAccusation?.id).not.toBe(nounAccusation?.id);
  });

  it('aliases 正确保存', () => {
    const sense = localLexicon.lookup('charge')?.senses.find(
      (item) => item.partOfSpeech === 'v.' && item.chineseMeaning === '收费'
    );
    expect(sense?.aliases).toContain('索价');
    expect(sense?.aliases).toContain('要价');
  });

  it('LexiconEntry 不会直接创建用户 Meaning，转换后才是候选', () => {
    const entry = localLexicon.lookup('charge');
    expect(entry).toBeDefined();
    expect('selectedForStudy' in (entry?.senses[0] ?? {})).toBe(false);

    const candidate = lexiconSenseToCandidate(entry!.senses[0]);
    expect(candidate.selectedForStudy).toBe(false);
    expect(candidate.source).toBe('lexicon');
  });

  it('每个 sense 都可独立转换，未选择不会进入用户词库', () => {
    const entry = localLexicon.lookup('charge');
    const candidates = lexiconEntryToCandidates(entry!);
    expect(candidates.length).toBe(entry!.senses.length);
    expect(candidates.every((candidate) => !candidate.selectedForStudy)).toBe(true);
  });

  it('同一个单词未来可同时支持 cet6 + ielts，而不复制词条', () => {
    const entry = localLexicon.lookup('charge');
    expect(entry?.packs).toContain('cet6');
    const allChargeKeys = localLexicon
      .list()
      .filter((item) => normalizeLexiconWord(item.word) === 'charge');
    expect(allChargeKeys).toHaveLength(1);
  });

  it('本地命中时不会请求远程 Provider', async () => {
    let remoteCalled = false;
    const result = await resolveCandidatesFromLocalFirst('charge', async () => {
      remoteCalled = true;
      throw new Error('should not be called');
    });

    expect(remoteCalled).toBe(false);
    expect(result.source).toBe('lexicon');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('本地没有时 fallback 正常', async () => {
    const result = await resolveCandidatesFromLocalFirst('not-a-real-word', async () => ({
      word: 'not-a-real-word',
      fromCache: false,
      meanings: [
        {
          partOfSpeech: 'n.',
          chineseMeaning: '远程候选',
          englishDefinition: 'remote candidate',
          translatedDefinition: '远程候选'
        }
      ]
    }));

    expect(result.source).toBe('remote');
    expect(result.candidates[0].chineseMeaning).toBe('远程候选');
  });
});
