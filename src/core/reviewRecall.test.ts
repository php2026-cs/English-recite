import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildRunQueue,
  isRecallFirst,
  ratingWithHint,
  recordsIndependentEvidence,
  type ReviewRun,
  type ReviewRunItem
} from './reviewRun';
import { choiceAnswerText, buildReviewChoices, stripPartOfSpeech, type ReviewChoice } from './reviewChoices';
import { readReviewDraft, reviewDraftKey } from '../services/srs/reviewDraft';

const items: ReviewRunItem[] = [{ taskId: 'choice-id', retry: 0, overdueDays: 0,
  word: { id: 'word', word: 'charge', createdAt: 1, updatedAt: 1 },
  meanings: [{ id: 'meaning', wordId: 'word', partOfSpeech: 'v.', chineseMeaning: '收费',
    selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1 }] }];

describe('可选直接回忆', () => {
  it('原方式仍是完整选择轮加输入轮，任务编号独立', () => {
    const queue = buildRunQueue(items, 'two-rounds', () => 'input-id');
    expect(queue.map(task => task.phase)).toEqual(['choice', 'input']);
    expect(queue.map(task => task.taskId)).toEqual(['choice-id', 'input-id']);
    expect(items[0].phase).toBeUndefined();
  });
  it('直接回忆只创建一次输入任务，保留待学义项', () => {
    const queue = buildRunQueue(items, 'recall-first', () => 'input-id');
    expect(queue).toHaveLength(1);
    expect(queue[0].phase).toBe('input');
    expect(queue[0].meanings).toEqual(items[0].meanings);
  });
  it('只有明确保存为直接回忆的本轮才改变流程，旧会话缺少 flow 时保持两轮', () => {
    expect(isRecallFirst({ flow: 'recall-first' })).toBe(true);
    expect(isRecallFirst({ flow: 'two-rounds' })).toBe(false);
    expect(isRecallFirst({})).toBe(false);
  });
});

describe('提示对评分的影响', () => {
  it('借助提示的正确答案不作为独立记得或熟练，失败仍是忘记', () => {
    expect(['again', 'hard', 'good', 'easy'].map(rating => ratingWithHint(rating as 'again' | 'hard' | 'good' | 'easy', true)))
      .toEqual(['again', 'hard', 'hard', 'hard']);
    expect(ratingWithHint('good', false)).toBe('good');
    expect(ratingWithHint('easy')).toBe('easy');
  });
  it('借助提示答对不更新表现画像，答错仍计入', () => {
    expect(recordsIndependentEvidence(false, 'again')).toBe(true);
    expect(recordsIndependentEvidence(false, 'good')).toBe(true);
    expect(recordsIndependentEvidence(true, 'again')).toBe(true);
    expect(recordsIndependentEvidence(true, 'good')).toBe(false);
    expect(recordsIndependentEvidence(true, 'easy')).toBe(false);
    // ratingWithHint has already downgraded these before the check runs.
    expect(recordsIndependentEvidence(true, 'hard')).toBe(false);
  });
});

describe('提示选项文本', () => {
  const option: ReviewChoice = { id: 'correct-meaning', label: 'v. 收费', sourceWord: 'charge', meaningIds: ['meaning'] };
  it('英译中只插入释义，去掉词性前缀', () => {
    expect(choiceAnswerText(option, 'en-zh')).toBe('收费');
    expect(stripPartOfSpeech('phrase 短语')).toBe('短语');
  });
  it('中译英插入完整英文单词', () => {
    expect(choiceAnswerText({ ...option, label: 'charge' }, 'zh-en')).toBe('charge');
  });
  it('词性加释义的格式与词典选项保持一致', () => {
    const entries = [{ id: 'e1', word: 'charge', packs: [], senses: [
      { id: 's1', partOfSpeech: 'v.', chineseMeaning: '收费', order: 0 }] }];
    const options = buildReviewChoices(items[0], 'en-zh', entries as never);
    const correct = options.find(row => row.id === 'correct-meaning');
    expect(correct?.label).toBe('v. 收费');
    expect(choiceAnswerText(correct!, 'en-zh')).toBe('收费');
  });
});

describe('提示状态的草稿恢复', () => {
  beforeAll(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      key: () => null,
      length: 0
    } as unknown as Storage;
  });
  beforeEach(() => { localStorage.clear(); });

  function createRun(): ReviewRun {
    return { id: 'run', sessionId: 'session', localOwnerUserId: null, mode: 'en-zh', flow: 'recall-first',
      status: 'active', index: 0, initialWordCount: 1, completedWords: 0, completedMeanings: 0,
      completedRetries: 0, unresolvedMeaningIds: [], updatedAt: 1, queue: items };
  }
  function writeDraft(run: ReviewRun, patch: Record<string, unknown>) {
    localStorage.setItem(reviewDraftKey(run), JSON.stringify({ version: 1, answers: { meaning: '收费' },
      revealed: false, ratings: {}, confidence: {}, elapsedMs: 10, hintUsed: true, ...patch }));
  }

  it('保留已使用提示的标记', () => {
    const run = createRun();
    writeDraft(run, {});
    expect(readReviewDraft(run)?.hintUsed).toBe(true);
  });
  it('提示标记类型异常时整份草稿作废，避免恢复出错误状态', () => {
    const run = createRun();
    writeDraft(run, { hintUsed: 'yes' });
    expect(readReviewDraft(run)).toBeUndefined();
  });
  it('没有提示标记的旧草稿仍然可以恢复', () => {
    const run = createRun();
    const draft = { version: 1, answers: { meaning: '收费' }, revealed: false, ratings: {}, confidence: {}, elapsedMs: 10 };
    localStorage.setItem(reviewDraftKey(run), JSON.stringify(draft));
    expect(readReviewDraft(run)).toBeDefined();
    expect(readReviewDraft(run)?.hintUsed).toBeUndefined();
  });
});
