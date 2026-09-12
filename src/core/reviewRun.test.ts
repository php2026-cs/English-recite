import { describe, expect, it } from 'vitest';
import { advanceChoiceRun, advanceReviewRun, type ReviewRun } from './reviewRun';

function createRun(count = 5): ReviewRun {
  return { id: 'run', sessionId: 'session', mode: 'en-zh', localOwnerUserId: null,
    status: 'active', index: 0, initialWordCount: count, completedWords: 0, completedMeanings: 0,
    completedRetries: 0, unresolvedMeaningIds: [], updatedAt: 1,
    queue: Array.from({ length: count }, (_, i) => ({
      taskId: `task${i}`, retry: 0, overdueDays: 0,
      word: { id: `w${i}`, word: `word${i}`, createdAt: 1, updatedAt: 1 },
      meanings: ['a', 'b'].map((suffix) => ({ id: `${i}${suffix}`, wordId: `w${i}`, partOfSpeech: 'v.', chineseMeaning: suffix,
        selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1 }))
    })) };
}

describe('本轮错义项再练', () => {
  it('选择轮推进到整批输入轮，不计算掌握数，并保留相同题目方向', () => {
    const run = createRun(2);
    const inputs = run.queue.map(task => ({ ...task, phase: 'input' as const, taskId: task.taskId + '-input' }));
    run.queue = [...run.queue.map(task => ({ ...task, phase: 'choice' as const })), ...inputs];
    const first = advanceChoiceRun(run, 'zh-en');
    expect(first.queue[first.index].phase).toBe('choice');
    const second = advanceChoiceRun(first, 'en-zh');
    expect(second.queue[second.index].phase).toBe('input');
    expect(second.queue[second.index].direction).toBe('zh-en');
    expect(second.completedWords).toBe(0);
    expect(second.completedMeanings).toBe(0);
    expect(second.completedRetries).toBe(0);
  });
  it('隔三个其他题目插入，只收忘记义项，原队列不变', () => {
    const run = createRun();
    const next = advanceReviewRun(run, [
      { meaning: run.queue[0].meanings[0], rating: 'good' },
      { meaning: run.queue[0].meanings[1], rating: 'again' }
    ], 'retry');
    expect(next.queue.map((task) => task.taskId)).toEqual(['task0', 'task1', 'task2', 'task3', 'retry', 'task4']);
    expect(next.queue[4].meanings.map((meaning) => meaning.id)).toEqual(['0b']);
    expect(next.index).toBe(1);
    expect(next.completedWords).toBe(1);
    expect(next.completedMeanings).toBe(2);
    expect(run.queue).toHaveLength(5);
  });
  it('不足三个其他单词时放到队尾，不插入已掌握义项', () => {
    const run = createRun(2);
    const next = advanceReviewRun(run, run.queue[0].meanings.map((meaning) => ({ meaning, rating: 'again' })), 'retry');
    expect(next.queue.map((task) => task.taskId)).toEqual(['task0', 'task1', 'retry']);
    const good = advanceReviewRun(run, run.queue[0].meanings.map((meaning) => ({ meaning, rating: 'hard' })), 'unused');
    expect(good.queue).toHaveLength(2);
  });
  it('连续忘记最多额外练两次，然后结束；不重复计算首次学习数量', () => {
    let run = createRun(1);
    for (let i = 0; i < 3; i++) {
      const current = run.queue[run.index];
      run = advanceReviewRun(run, current.meanings.map((meaning) => ({ meaning, rating: 'again' })), `retry${i}`);
    }
    expect(run.status).toBe('finished');
    expect(run.queue).toHaveLength(3);
    expect(run.completedWords).toBe(1);
    expect(run.completedMeanings).toBe(2);
    expect(run.completedRetries).toBe(2);
    expect(run.unresolvedMeaningIds).toHaveLength(2);
  });
  it('再练记住后移除未掌握标记，不再追加', () => {
    let run = createRun(1);
    run = advanceReviewRun(run, run.queue[0].meanings.map((meaning) => ({ meaning, rating: 'again' })), 'retry');
    run = advanceReviewRun(run, run.queue[1].meanings.map((meaning) => ({ meaning, rating: 'good' })), 'unused');
    expect(run.status).toBe('finished');
    expect(run.unresolvedMeaningIds).toEqual([]);
    expect(run.completedRetries).toBe(1);
  });
});
