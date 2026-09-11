import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from './Button';
import { ConfidencePicker } from './ConfidencePicker';
import { evaluateEnZhSlots, groupMeaningsByPartOfSpeech, type EnZhSlotResult } from '../core/wordReview';
import { createReviewTimer } from '../core/reviewTimer';
import { getLexiconAliases } from '../services/lexicon/lexiconAliases';
import { findStudyExample, isFirstStudy } from '../services/lexicon/studyExamples';
import { submitAdaptiveWordReview } from '../services/srs/srsReviewService';
import type { ReviewRun } from '../core/reviewRun';
import type { ReviewQuestion } from '../core/adaptiveReview';
import { readReviewDraft, useReviewDraft } from '../services/srs/reviewDraft';
import { reviewStateRepository } from '../services/srs/reviewState';
import type { Meaning, ReviewRating } from '../types';
import { mergePersonalAliases, personalVocabularyRepository } from '../repositories/personalVocabularyRepository';
import { normalizeChinese } from '../lib/strings';
import { splitHighlightedExample } from '../core/exampleHighlight';

const POS_NAMES: Record<string, string> = {
  'n.': '名词', 'v.': '动词', 'adj.': '形容词', 'adv.': '副词',
  'prep.': '介词', 'conj.': '连词', 'pron.': '代词', 'num.': '数词',
  'interj.': '感叹词', phrase: '短语', other: '其他词性'
};
const RATINGS: Array<{ value: ReviewRating; label: string }> = [
  { value: 'again', label: '忘记' }, { value: 'hard', label: '困难' },
  { value: 'good', label: '记得' }, { value: 'easy', label: '熟练' }
];

export function EnZhWordQuestion({ run, onSaved, question }: {
  run: ReviewRun;
  onSaved: (run: ReviewRun) => void;
  question?: ReviewQuestion;
}) {
  const item = run.queue[run.index];
  const last = run.index === run.queue.length - 1;
  const [initial] = useState(() => readReviewDraft(run));
  const personalAliases = useLiveQuery(() => personalVocabularyRepository.listAliases(), []);
  const aliases = useMemo(() => mergePersonalAliases(item.word.word, item.meanings, personalAliases ?? []),
    [item.word.word, item.meanings, personalAliases]);
  const [aliasSaving, setAliasSaving] = useState<string | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const groups = useMemo(() => groupMeaningsByPartOfSpeech(item.meanings), [item.meanings]);
  const reviewStates = useLiveQuery(async () => new Map(await Promise.all(item.meanings.map(async (meaning) =>
    [meaning.id, await reviewStateRepository.get(meaning.id)] as const))), [item]);
  const slots = useMemo(() => groups.flatMap((group) => group.meanings), [groups]);
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [results, setResults] = useState<EnZhSlotResult[] | null>(() => initial?.revealed
    ? evaluateEnZhSlots(item.meanings, initial.answers, getLexiconAliases(item.word.word, item.meanings)) : null);
  const [ratings, setRatings] = useState<Record<string, ReviewRating>>(initial?.ratings ?? {});
  const [confidence, setConfidence] = useState<Record<string, number>>(initial?.confidence ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elapsed = useRef(initial?.elapsedMs ?? 0);
  const baseElapsed = initial?.elapsedMs ?? 0;
  const timer = useRef(createReviewTimer());
  const revealed = useRef(initial?.revealed ?? false);
  const saveLock = useRef(false);
  const active = useRef(true);
  const firstInput = useRef<HTMLInputElement>(null);
  const draft = useReviewDraft(run, { answers, revealed: results !== null, ratings, confidence, question },
    () => revealed.current ? elapsed.current : baseElapsed + timer.current.getElapsedMs());

  useEffect(() => {
    if (revealed.current) setResults(evaluateEnZhSlots(item.meanings, answers, aliases));
  }, [aliases]);

  async function acceptAnswer(result: EnZhSlotResult) {
    setAliasSaving(result.slotId);
    setAliasError(null);
    try {
      await personalVocabularyRepository.accept(result.meaning, result.input);
      if (active.current) setRatings((values) => ({ ...values, [result.meaning.id]: 'good' }));
    } catch {
      if (active.current) setAliasError('表达保存失败，请重试。');
    } finally { if (active.current) setAliasSaving(null); }
  }

  async function undoAlias(id: string, result: EnZhSlotResult) {
    setAliasSaving(result.slotId);
    setAliasError(null);
    try {
      await personalVocabularyRepository.removeAlias(id);
      if (active.current) setRatings((values) => ({ ...values, [result.meaning.id]: 'again' }));
    } catch {
      if (active.current) setAliasError('撤销失败，请重试。');
    } finally { if (active.current) setAliasSaving(null); }
  }

  useEffect(() => {
    active.current = true;
    if (!revealed.current) timer.current.start();
    if (document.hidden) timer.current.pause();
    firstInput.current?.focus();
    function onVisibility() {
      if (revealed.current) return;
      if (document.hidden) timer.current.pause();
      else timer.current.resume();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active.current = false;
      timer.current.stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  function reveal() {
    if (revealed.current || !personalAliases) return;
    revealed.current = true;
    elapsed.current = baseElapsed + timer.current.stop();
    const evaluated = evaluateEnZhSlots(item.meanings, answers, aliases);
    setResults(evaluated);
    setRatings(Object.fromEntries(evaluated.map((result) => [result.meaning.id, result.correct ? 'good' : 'again'])));
  }

  async function save() {
    if (!results || saveLock.current || aliasSaving) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const nextRun = await submitAdaptiveWordReview({
        reviewRun: { id: run.id, sessionId: run.sessionId, taskId: item.taskId },
        word: item.word, questionType: 'en-to-zh', responseTimeMs: elapsed.current,
        results: results.map((result) => ({
          meaning: result.meaning, inputValue: result.input,
          rating: ratings[result.meaning.id], confidence: confidence[result.meaning.id]
        })),
        recordEnZhSession: true
      });
      draft.committed();
      if (active.current && nextRun) onSaved(nextRun);
    } catch {
      if (active.current) {
        setError('保存失败，答案和掌握程度已保留，请重试。若词库或账号已变更，请返回后重新开始。');
        setSaving(false);
        saveLock.current = false;
      }
    }
  }

  return <div className="rounded-3xl bg-white p-5 shadow-soft sm:p-6">
    {aliasError && <p role="alert" className="mb-3 text-sm text-red-600">{aliasError}</p>}
    {draft.failed && <p role="alert" className="mb-3 text-sm text-red-600">答案暂存失败，请先保存本题再退出。</p>}
    <p className="mb-3 text-sm font-medium text-brand-700">英译中</p>
    <h2 className="break-words text-3xl font-semibold tracking-tight text-slate-900">{item.word.word}</h2>
    {item.word.phonetic && <p className="mt-1 text-sm text-slate-400">{item.word.phonetic}</p>}
    <p className="mt-3 text-sm leading-6 text-slate-500">按词性回忆，每格填写一个释义。同一词性内顺序不限，想不起来的可以留空。</p>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="词性提示">
      {groups.map((group) => <span key={group.partOfSpeech} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
        {POS_NAMES[group.partOfSpeech] ?? group.partOfSpeech} {group.meanings.length} 个
      </span>)}
    </div>
    {results && <p role="status" className="mt-4 text-sm font-medium text-slate-700">
      匹配 {results.filter((result) => result.correct).length} / {results.length} 个义项
    </p>}
    <form onSubmit={(event) => { event.preventDefault(); reveal(); }} className="mt-6 space-y-6">
      {groups.map((group) => <section key={group.partOfSpeech} aria-label={`${POS_NAMES[group.partOfSpeech] ?? group.partOfSpeech}填空`}>
        <h3 className="mb-3 flex items-baseline gap-2 border-b border-slate-100 pb-3 font-semibold text-slate-900">
          {POS_NAMES[group.partOfSpeech] ?? group.partOfSpeech}
          <span className="text-sm font-medium text-brand-700">{group.partOfSpeech}</span>
          <span className="ml-auto text-xs font-normal text-slate-500">{group.meanings.length} 个释义</span>
        </h3>
        <div className="space-y-4">
          {group.meanings.map((slot, index) => {
            const result = results?.find((row) => row.slotId === slot.id);
            const selectedRating = result ? ratings[result.meaning.id] : undefined;
            const acceptedAlias = result && personalAliases?.find((row) => row.meaningId === result.meaning.id &&
              row.chineseMeaning === result.meaning.chineseMeaning && row.partOfSpeech === result.meaning.partOfSpeech &&
              normalizeChinese(row.alias) === normalizeChinese(result.input));
            const slotIndex = slots.findIndex((meaning) => meaning.id === slot.id);
            return <div key={slot.id} data-review-slot={slot.id} className="rounded-2xl border border-slate-200 p-3 sm:p-4">
              <label htmlFor={`en-zh-slot-${slot.id}`} className="mb-2 block text-sm font-medium text-slate-600">
                {group.partOfSpeech} 释义 {index + 1}
              </label>
              <input id={`en-zh-slot-${slot.id}`} ref={slotIndex === 0 ? firstInput : undefined}
                value={answers[slot.id] ?? ''} disabled={results !== null}
                aria-describedby={result ? `en-zh-feedback-${slot.id}` : undefined}
                onChange={(event) => setAnswers((values) => ({ ...values, [slot.id]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  if (event.nativeEvent.isComposing) { event.preventDefault(); return; }
                  if (slotIndex < slots.length - 1) {
                    event.preventDefault();
                    document.getElementById(`en-zh-slot-${slots[slotIndex + 1].id}`)?.focus();
                  }
                }}
                placeholder={`输入${POS_NAMES[group.partOfSpeech] ?? '中文'}释义`}
                autoComplete="off" autoCorrect="off"
                className={`h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:text-slate-700 ${
                  result?.correct ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                }`} />
              {result && <div id={`en-zh-feedback-${slot.id}`} className="mt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-slate-900">参考答案：{result.meaning.chineseMeaning}</p>
                  <span className={`text-xs ${result.correct ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {result.correct ? '✓ 已匹配' : '未匹配，可自行调整'}
                  </span>
                </div>
                {!result.correct && normalizeChinese(result.input) && <div className="mt-3">
                  <Button variant="secondary" size="sm" disabled={saving || aliasSaving !== null}
                    onClick={() => void acceptAnswer(result)}>{aliasSaving === result.slotId ? '保存表达中…' : '这个答案也算对'}</Button>
                  <p className="mt-1 text-xs leading-5 text-slate-500">记住“{result.input}”作为“{result.meaning.chineseMeaning}”的可接受答案。</p>
                </div>}
                {acceptedAlias && <div className="mt-2 text-xs text-brand-700">
                  <span>已使用你的可接受答案</span>
                  <button type="button" className="ml-2 underline underline-offset-2" disabled={saving || aliasSaving !== null}
                    onClick={() => void undoAlias(acceptedAlias.id, result)}>撤销这个表达</button>
                </div>}
                <fieldset disabled={saving} className="mt-3 min-w-0">
                  <legend className="mb-2 text-sm text-slate-500">掌握程度 · {RATINGS.find((rating) => rating.value === selectedRating)?.label}</legend>
                  <div role="group" aria-label={`${result.meaning.chineseMeaning}掌握程度`} className="grid grid-cols-4 gap-2">
                    {RATINGS.map((rating) => <Button key={rating.value} disabled={saving} className="px-1" size="sm"
                      aria-pressed={selectedRating === rating.value}
                      variant={selectedRating === rating.value ? 'primary' : 'secondary'}
                      onClick={() => setRatings((values) => ({ ...values, [result.meaning.id]: rating.value }))}>
                      {rating.label}
                    </Button>)}
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-slate-500">信心反馈（选填）</summary>
                    <div className="mt-2"><ConfidencePicker value={confidence[result.meaning.id] ?? -1}
                      disabled={saving} columnsClassName="grid-cols-2 sm:grid-cols-4"
                      onChange={(value) => setConfidence((values) => ({ ...values, [result.meaning.id]: value }))} /></div>
                  </details>
                </fieldset>
                {reviewStates && <StudyExamplePanel key={result.meaning.id} word={item.word.word} meaning={result.meaning}
                  firstStudy={isFirstStudy(result.meaning, reviewStates.get(result.meaning.id))} />}
              </div>}
            </div>;
          })}
        </div>
      </section>)}
      {!results && <Button type="submit" disabled={!personalAliases} className="w-full">查看答案</Button>}
    </form>
    {results && <div className="mt-5">
      <p className="mb-3 text-xs leading-5 text-slate-500">每个义项分别保存掌握程度，并据此安排下次复习。</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      <Button onClick={() => void save()} disabled={saving || aliasSaving !== null} className="w-full">
        {saving ? '保存中…' : error ? '重试保存' : last && (!Object.values(ratings).includes('again') || item.retry >= 2) ? '保存并完成' : '保存并下一词'}
      </Button>
    </div>}
  </div>;
}

function StudyExamplePanel({ word, meaning, firstStudy }: { word: string; meaning: Meaning; firstStudy: boolean }) {
  const [expanded, setExpanded] = useState(firstStudy);
  const example = findStudyExample(word, meaning);
  return <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} className="mt-3 rounded-xl bg-brand-50 p-3">
    <summary className="cursor-pointer text-sm font-medium text-brand-700">例句{firstStudy ? ' · 首次学习' : ''}</summary>
    <div className="mt-2 text-sm leading-6">
      {example ? <>
        <p lang="en" className="text-slate-800">{splitHighlightedExample(example.english, word).map((part, index) =>
          part.highlighted ? <mark key={index} className="rounded bg-amber-200 px-0.5 font-semibold text-slate-900" title={`当前学习：${word}`}>
            {part.text}
          </mark> : part.text)}</p>
        <p className="mt-1 text-slate-500">{example.chinese}</p>
        <p className="mt-2 text-xs text-slate-400">学习例句 · AI 编写</p>
      </> : <p className="text-slate-500">该义项暂无例句。</p>}
    </div>
  </details>;
}
