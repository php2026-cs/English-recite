import { useEffect, useRef, useState } from 'react';
import type { ReviewRun } from '../core/reviewRun';
import { buildReviewChoices, type ReviewChoice } from '../core/reviewChoices';
import { readReviewDraft, useReviewDraft } from '../services/srs/reviewDraft';
import { saveChoiceProgress } from '../services/srs/reviewRunRepository';
import { buildAdaptiveWordQuestion } from '../services/personalization/reviewController';
import { findStudyExample } from '../services/lexicon/studyExamples';
import { splitHighlightedExample } from '../core/exampleHighlight';
import { Button } from './Button';

export function ChoiceWordQuestion({ run, onSaved }: { run: ReviewRun; onSaved: (run: ReviewRun) => void }) {
  const item = run.queue[run.index];
  const [initial] = useState(() => readReviewDraft(run));
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [revealed, setRevealed] = useState(initial?.revealed ?? false);
  const [direction, setDirection] = useState<'en-zh' | 'zh-en' | null>(null);
  const [options, setOptions] = useState<ReviewChoice[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const draft = useReviewDraft(run, { answers, revealed,
    ratings: Object.fromEntries(item.meanings.map(m => [m.id, 'good' as const])), confidence: {} }, () => 0);
  useEffect(() => {
    let active = true;
    setError('');
    void (async () => {
      const remembered = initial?.answers.__direction;
      const next = remembered === 'en-zh' || remembered === 'zh-en' ? remembered : item.direction ?? (run.mode === 'adaptive'
        ? (await buildAdaptiveWordQuestion(item.word, item.meanings)).questionType === 'en-to-zh' ? 'en-zh' : 'zh-en'
        : run.mode);
      const { localLexicon } = await import('../services/lexicon/localLexicon');
      const choices = buildReviewChoices(item, next, localLexicon.list());
      if (active) { setDirection(next); setOptions(choices); setAnswers(values => ({ ...values, __direction: next })); }
    })().catch(() => { if (active) setError('选项加载失败，请检查网络后重试。'); });
    return () => { active = false; };
  }, [item, attempt]);
  async function save() {
    if (lock.current || !direction || !revealed) return;
    lock.current = true; setSaving(true); setError('');
    try { const next = await saveChoiceProgress(run, direction); draft.committed(); onSaved(next); }
    catch { setError('进度保存失败，请重试。'); lock.current = false; setSaving(false); }
  }
  const correct = options.filter(option => option.meaningIds.length > 0);
  const selected = options.filter(option => answers[option.id] === 'yes');
  const success = selected.length === correct.length && selected.every(option => option.meaningIds.length > 0);
  if (!options.length) return <div className="rounded-3xl bg-white p-6 shadow-soft">
    <p role={error ? 'alert' : 'status'}>{error || '正在准备形近词选项…'}</p>
    {error && <Button className="mt-4" onClick={() => setAttempt(value => value + 1)}>重试</Button>}
  </div>;
  return <div className="rounded-3xl bg-white p-5 shadow-soft sm:p-8">
    <p className="mb-4 text-sm font-semibold text-brand-700">第一轮 · {direction === 'en-zh' ? '英译中多选' : '中译英单选'}</p>
    {direction === 'en-zh' ? <h2 className="review-meaning">{item.word.word}</h2> : <div className="space-y-5">
      {item.meanings.map(meaning => <h2 key={meaning.id} className="review-meaning"><span className="mr-3 text-lg text-brand-700">{meaning.partOfSpeech}</span>{meaning.chineseMeaning}</h2>)}
    </div>}
    <p className="my-5 text-base font-semibold text-slate-700">共 {options.length} 个选项，请选 {correct.length} 项 · 已选 {selected.length} 项</p>
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="答案选项">
      {options.map((option, index) => <button key={option.id} type="button" disabled={revealed}
        aria-pressed={answers[option.id] === 'yes'} onClick={() => setAnswers(values => direction === 'zh-en'
          ? { __direction: direction, [option.id]: 'yes' }
          : { ...values, [option.id]: values[option.id] === 'yes' ? '' : 'yes' })}
        className={`choice-option min-h-20 rounded-2xl border-2 p-4 text-left transition-colors ${revealed && option.meaningIds.length ? 'border-emerald-500 bg-emerald-50' : revealed && answers[option.id] === 'yes' ? 'border-red-400 bg-red-50' : answers[option.id] === 'yes' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
        <span className="mr-3 text-sm font-bold text-brand-700">{String.fromCharCode(65 + index)}</span>
        <span className="break-words text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl">{option.label}</span>
        {revealed && <span className="mt-2 block text-sm text-slate-600">{option.meaningIds.length ? '✓ 正确选项' : `干扰词：${option.sourceWord}`}</span>}
      </button>)}
    </div>
    {!revealed ? <div className="mt-5">
      <Button className="w-full" disabled={selected.length !== correct.length} onClick={() => setRevealed(true)}>确认选择</Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => setRevealed(true)}>想不起来，查看答案</Button>
    </div> : <div className="mt-5">
      <p role="status" className="font-semibold text-slate-800">{success ? '全部选对' : '再看一眼正确选项'} · 第二轮还会练习输入</p>
      {item.meanings.map(meaning => {
        const example = findStudyExample(item.word.word, meaning);
        return example ? <details key={meaning.id} className="mt-3 rounded-xl bg-slate-50 p-3" open={!meaning.lastReviewedAt && meaning.correctCount + meaning.incorrectCount === 0}>
          <summary className="cursor-pointer text-sm text-brand-700">{meaning.chineseMeaning} · 例句</summary>
          <p className="mt-2">{splitHighlightedExample(example.english, item.word.word).map((part, i) => part.highlighted ? <mark key={i} className="bg-amber-200 font-semibold">{part.text}</mark> : part.text)}</p>
          <p className="mt-1 text-sm text-slate-500">{example.chinese} · AI 编写</p>
        </details> : null;
      })}
      <Button className="mt-5 w-full" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : run.queue[run.index + 1]?.phase === 'input' ? '进入第二轮 · 输入回忆' : '下一题'}</Button>
    </div>}
    {(error || draft.failed) && <p role="alert" className="mt-3 text-red-600">{error || '答案暂存失败，请先保存本题。'}</p>}
  </div>;
}
