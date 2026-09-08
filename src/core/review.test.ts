import { describe, expect, it } from 'vitest';
import type { Meaning, Word } from '../types';
import {
  buildEnZhQueue,
  buildZhEnQueue,
  createEnZhSession,
  evaluateChineseInput,
  getRemainingCount,
  getRevealedMeanings,
  recallMeaning,
  revealEnZhSession,
  type EnZhItem
} from './review';

const word = createWord('w1', 'charge');

function createWord(id: string, value: string): Word {
  return {
    id,
    word: value,
    createdAt: 1,
    updatedAt: 1
  };
}

function createMeaning(
  id: string,
  wordId: string,
  partOfSpeech: string,
  chineseMeaning: string,
  selectedForStudy = true
): Meaning {
  return {
    id,
    wordId,
    partOfSpeech,
    chineseMeaning,
    selectedForStudy,
    correctCount: 0,
    incorrectCount: 0,
    createdAt: 1,
    updatedAt: 1
  };
}

function chargeMeanings(): Meaning[] {
  return [
    createMeaning('m1', 'w1', 'v.', '收费'),
    createMeaning('m2', 'w1', 'v.', '指控'),
    createMeaning('m3', 'w1', 'v.', '冲锋'),
    createMeaning('m4', 'w1', 'n.', '费用'),
    createMeaning('m5', 'w1', 'n.', '指控', false),
    createMeaning('m6', 'w1', 'n.', '电荷', false)
  ];
}

describe('一词多义与队列构建', () => {
  it('一个单词可以有多个独立 Meaning', () => {
    expect(chargeMeanings()).toHaveLength(6);
  });

  it('selectedForStudy = false 的释义不会进入背诵队列', () => {
    const zhQueue = buildZhEnQueue([word], chargeMeanings());
    expect(zhQueue.map((item) => item.meaningId)).toEqual(['m1', 'm2', 'm3', 'm4']);

    const enQueue = buildEnZhQueue([word], chargeMeanings());
    expect(enQueue[0].meanings.map((meaning) => meaning.id)).toEqual([
      'm1',
      'm2',
      'm3',
      'm4'
    ]);
  });

  it('中译英一个 Meaning 对应一道题', () => {
    const queue = buildZhEnQueue([word], chargeMeanings());
    expect(queue).toHaveLength(4);
    expect(queue[0].chineseMeaning).toBe('收费');
    expect(queue[1].chineseMeaning).toBe('指控');
  });
});

describe('英译中宽松匹配与计数', () => {
  const item: EnZhItem = {
    wordId: 'w1',
    word: 'charge',
    meanings: chargeMeanings().filter((meaning) => meaning.selectedForStudy)
  };

  it('正确统计 Meaning 数量并计算还差几个释义', () => {
    const session = createEnZhSession(item);
    expect(session.meanings).toHaveLength(4);
    expect(getRemainingCount(session)).toBe(4);

    const afterOne = recallMeaning(session, 'm1');
    expect(getRemainingCount(afterOne)).toBe(3);
  });

  it('重复输入一个中文释义不会重复计数', () => {
    let session = createEnZhSession(item);
    expect(evaluateChineseInput(session, '收费').status).toBe('matched');
    session = recallMeaning(session, 'm1');
    expect(evaluateChineseInput(session, '收费')).toEqual({
      status: 'duplicate',
      meaningId: 'm1'
    });
    expect(getRemainingCount(session)).toBe(3);
  });

  it('去掉标点和空格后仍能匹配', () => {
    const session = createEnZhSession(item);
    expect(evaluateChineseInput(session, ' 收费， ')).toEqual({
      status: 'matched',
      meaningId: 'm1'
    });
  });

  it('查看答案后正确区分 recalled / missed', () => {
    let session = createEnZhSession(item);
    session = recallMeaning(session, 'm1');
    session = recallMeaning(session, 'm4');
    const revealed = revealEnZhSession(session);
    const result = getRevealedMeanings(revealed);
    const recalled = result.filter((entry) => entry.recalled).map((entry) => entry.meaning.id);
    const missed = result.filter((entry) => !entry.recalled).map((entry) => entry.meaning.id);

    expect(recalled).toEqual(['m1', 'm4']);
    expect(missed).toEqual(['m2', 'm3']);
  });
});

describe('数据关联边界', () => {
  it('删除一个 Meaning 不影响其他 Meaning', () => {
    const meanings = chargeMeanings().filter((meaning) => meaning.id !== 'm2');
    const queue = buildZhEnQueue([word], meanings);
    expect(queue.map((item) => item.meaningId)).toEqual(['m1', 'm3', 'm4']);
  });

  it('删除 Word 时孤儿 Meaning 不会进入队列', () => {
    const orphan = createMeaning('orphan', 'missing-word', 'v.', '孤儿');
    const queue = buildZhEnQueue([word], [orphan]);
    expect(queue).toHaveLength(0);
  });
});
