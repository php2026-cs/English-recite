import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { ConfidencePicker } from './ConfidencePicker';
import { EnZhWordQuestion } from './EnZhWordQuestion';
import type { ReviewQuestion } from '../core/adaptiveReview';
import { createReviewQuestion } from '../core/adaptiveReview';
import { evaluateAdaptiveWordAnswers, type AdaptiveMeaningResult } from '../core/adaptiveWordReview';
import { createReviewTimer } from '../core/reviewTimer';
import { getLexiconAliases } from '../services/lexicon/localLexicon';
import { buildAdaptiveWordQuestion } from '../services/personalization/reviewController';
import { submitAdaptiveWordReview } from '../services/srs/srsReviewService';
import type { ReviewRating } from '../types';
import type { ReviewRun } from '../core/reviewRun';
import { readReviewDraft, useReviewDraft } from '../services/srs/reviewDraft';

const RATINGS: Array<{ rating: ReviewRating; label: string }> = [
  { rating: 'again', label: '忘记' }, { rating: 'hard', label: '困难' },
  { rating: 'good', label: '记得' }, { rating: 'easy', label: '熟练' }
];
export function AdaptiveWordQuestion({ run, onSaved }: {
  run: ReviewRun; onSaved: (run: ReviewRun) => void;
}) {
  const item = run.queue[run.index];
  const last = run.index === run.queue.length - 1;
  const [initial] = useState(() => readReviewDraft(run));
  const [question, setQuestion] = useState<ReviewQuestion | null>(initial?.question ?? null);
  const [answers, setAnswers] = useState<string[]>([initial?.answers.english ?? '']);
  const [results, setResults] = useState<AdaptiveMeaningResult[] | null>(() => initial?.revealed && initial.question && initial.question.questionType !== 'en-to-zh'
    ? evaluateAdaptiveWordAnswers(item.word.word, item.meanings, initial.question.questionType, [initial.answers.english ?? '']) : null);
  const [ratings, setRatings] = useState<Record<string, ReviewRating>>(initial?.ratings ?? {});
  const [confidence, setConfidence] = useState<Record<string, number>>(initial?.confidence ?? {});
  const [elapsedMs, setElapsedMs] = useState(initial?.elapsedMs ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const timer = useRef(createReviewTimer());
  const submitted = useRef(initial?.revealed ?? false);
  const saveLock = useRef(false);
  const active = useRef(true);
  const baseElapsed = initial?.elapsedMs ?? 0;
  const draft = useReviewDraft(run, { question: question ?? undefined, answers: { english: answers[0] ?? '' },
    revealed: results !== null, ratings, confidence }, () => submitted.current ? elapsedMs : baseElapsed + timer.current.getElapsedMs(),
    question !== null && question.questionType !== 'en-to-zh');

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const prepare = initial?.question ? Promise.resolve(initial.question) : run.mode === 'zh-en'
      ? Promise.resolve(createReviewQuestion({ id: item.taskId, word: item.word, meaning: item.meanings[0], questionType: 'zh-to-en' }))
      : buildAdaptiveWordQuestion(item.word, item.meanings);
    void prepare.then((next) => {
      if (cancelled) return;
      setQuestion(next);
      timer.current = createReviewTimer();
      if (!submitted.current) timer.current.start();
      if (document.hidden) timer.current.pause();
    }).catch(() => {
      if (!cancelled) setError('题目加载失败，请重试。');
    });
    return () => { cancelled = true; timer.current.stop(); };
  }, [item, attempt]);

  useEffect(() => {
    const onVisibility = () => {
      if (!question || submitted.current) return;
      if (document.hidden) timer.current.pause();
      else timer.current.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [question]);

  function submit(reveal = false) {
    if (!question || submitted.current || (!reveal && !answers.some((answer) => answer.trim()))) return;
    submitted.current = true;
    setElapsedMs(baseElapsed + timer.current.stop());
    const evaluated = evaluateAdaptiveWordAnswers(item.word.word, item.meanings,
      question.questionType, answers, getLexiconAliases(item.word.word, item.meanings));
    setResults(evaluated);
    setRatings(Object.fromEntries(evaluated.map((result) => [result.meaning.id, result.correct ? 'good' : 'again'])));
  }

  async function save() {
    if (!question || !results || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const nextRun = await submitAdaptiveWordReview({ word: item.word, questionType: question.questionType,
        reviewRun: { id: run.id, sessionId: run.sessionId, taskId: item.taskId },
        responseTimeMs: elapsedMs,
        results: results.map((result) => ({ meaning: result.meaning,
          rating: ratings[result.meaning.id], confidence: confidence[result.meaning.id],
          inputValue: result.inputValue }))
      });
      draft.committed();
      if (active.current && nextRun) onSaved(nextRun);
      // Keep the lock after success until this word's component unmounts.
    } catch {
      if (active.current) {
        setError('保存失败，答案和评分已保留，请重试。若词库或账号已变更，请返回后重新开始。');
        setSaving(false);
        saveLock.current = false;
      }
    }
  }

  if (!question) return <div className="rounded-3xl bg-white p-6 shadow-soft">
    <p role={error ? 'alert' : 'status'}>{error ?? '正在准备题目…'}</p>
    {error && <Button className="mt-4" onClick={() => setAttempt((value) => value + 1)}>重试</Button>}
  </div>;
  if (question.questionType === 'en-to-zh') {
    return <EnZhWordQuestion run={run} onSaved={onSaved} question={question} />;
  }
  return <div className="rounded-3xl bg-white p-5 shadow-soft sm:p-6">
    {draft.failed && <p role="alert" className="mb-3 text-sm text-red-600">答案暂存失败，请先保存本题再退出。</p>}
    <p className="mb-4 text-sm font-medium text-brand-700">{question.questionType === 'spelling' ? '拼写' : '中译英'}</p>
    <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="space-y-3">
        {item.meanings.map((meaning) => <p key={meaning.id} className="text-xl text-slate-900">
          <span className="mr-3 text-sm font-semibold text-brand-700">{meaning.partOfSpeech}</span>{meaning.chineseMeaning}
        </p>)}
      </div>
      <div className="mt-6 space-y-3">
        {answers.map((answer, slot) => <div key={slot}>
          <label htmlFor={`adaptive-answer-${slot}`} className="mb-2 block text-sm font-medium text-slate-700">
            请输入英文单词
          </label>
          <input id={`adaptive-answer-${slot}`} autoFocus={slot === 0} value={answer} disabled={results !== null}
            autoComplete="off" autoCapitalize="none" autoCorrect="off"
            onChange={(event) => setAnswers((values) => values.map((value, i) => i === slot ? event.target.value : value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing && slot < answers.length - 1) {
                event.preventDefault();
                document.getElementById(`adaptive-answer-${slot + 1}`)?.focus();
              }
            }}
            placeholder="输入英文"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" />
        </div>)}
      </div>
      {!results && <>
        <Button type="submit" disabled={!answers.some((answer) => answer.trim())} className="mt-5 w-full">提交答案</Button>
        <Button variant="ghost" onClick={() => submit(true)} className="mt-2 w-full">想不起来，查看答案</Button>
      </>}
    </form>
    {results && <div className="mt-6">
      <div role="status" className="rounded-xl bg-slate-50 p-4">
        <p className="mb-2 font-semibold text-slate-900">正确答案：{item.word.word}</p>
        <p className="font-medium text-slate-700">匹配 {results.filter((result) => result.correct).length} / {results.length} 个义项</p>
        <p className="mt-1 text-sm text-slate-500">请按实际记忆情况逐项评分，每个义项分别安排下次复习。</p>
      </div>
      {results.map((result, i) => <fieldset key={result.meaning.id} disabled={saving}
        className="mt-4 min-w-0 rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-600">义项 {i + 1} · {result.correct ? '✓ 已匹配' : '未匹配'}</legend>
        <p className="mb-4 text-lg font-semibold text-slate-900"><span className="mr-2 text-sm text-brand-700">{result.meaning.partOfSpeech}</span>{result.meaning.chineseMeaning}</p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label={`义项 ${i + 1} 评分`}>
          {RATINGS.map(({ rating, label }) => <Button key={rating} disabled={saving} className="px-1"
            aria-pressed={ratings[result.meaning.id] === rating}
            variant={ratings[result.meaning.id] === rating ? 'primary' : 'secondary'}
            onClick={() => setRatings((values) => ({ ...values, [result.meaning.id]: rating }))}>{label}</Button>)}
        </div>
        <p className="mb-2 mt-4 text-sm text-slate-500">你有多确定？（选填）</p>
        <ConfidencePicker value={confidence[result.meaning.id] ?? -1} disabled={saving}
          columnsClassName="grid-cols-2 sm:grid-cols-4"
          onChange={(value) => setConfidence((values) => ({ ...values, [result.meaning.id]: value }))} />
      </fieldset>)}
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      <Button onClick={() => void save()} disabled={saving} className="mt-5 w-full">
        {saving ? '保存中…' : error ? '重试保存' : last && (!Object.values(ratings).includes('again') || item.retry >= 2) ? '保存并完成' : '保存并下一词'}
      </Button>
    </div>}
  </div>;
}

