import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { type ReviewRun, type ReviewRunMode, MAX_RETRIES } from '../core/reviewRun';
import { loadReviewRun, finishReviewRun } from '../services/srs/reviewRunRepository';
import { PageHeader } from './PageHeader';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { EnZhWordQuestion } from './EnZhWordQuestion';
import { AdaptiveWordQuestion } from './AdaptiveWordQuestion';

export const REVIEW_TITLES = { 'en-zh': '英译中', 'zh-en': '中译英', adaptive: '智能复习' };
const LINK_CLASS = 'inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700';

export function ReviewRunPage({ mode }: { mode: ReviewRunMode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageHeader title={REVIEW_TITLES[mode]} subtitle="正在加载…" />;
  return <OwnedRun key={`${user?.id ?? 'anonymous'}:${mode}`} mode={mode} />;
}

function OwnedRun({ mode }: { mode: ReviewRunMode }) {
  const [run, setRun] = useState<ReviewRun | null>(null);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ending, setEnding] = useState(false);
  const title = REVIEW_TITLES[mode];
  useEffect(() => {
    let active = true;
    setError(null);
    void loadReviewRun(mode).then((result) => {
      if (active) { setRun(result.run); setResumed(result.resumed); }
    }).catch(() => { if (active) setError('复习进度加载失败，请重试。'); });
    return () => { active = false; };
  }, [mode, attempt]);

  async function finish() {
    if (!run || ending) return;
    setEnding(true);
    try { setRun(await finishReviewRun(run)); }
    catch { setError('结束本轮失败，请重试。已保存的复习结果不受影响。'); }
    finally { setEnding(false); }
  }

  if (!run) return <>
    <PageHeader title={title} subtitle={error ?? '正在读取本轮进度…'} />
    {error && <Button onClick={() => setAttempt((value) => value + 1)}>重试</Button>}
  </>;
  if (run.queue.length === 0) return <>
    <PageHeader title={title} />
    <EmptyState icon="🧠" title="当前没有待复习的单词" description="已选义项尚未到期，或本轮新义项额度已用完。"
      action={<Link to="/words" className={LINK_CLASS}>去词库</Link>} />
  </>;
  if (run.status === 'finished') return <>
    <PageHeader title={title} subtitle="本轮结束，已保存学习进度。" />
    <div role="status" className="rounded-3xl bg-white p-6 text-center shadow-soft sm:p-8">
      <h2 className="text-2xl font-semibold text-slate-900">已完成 {run.completedWords} 个单词</h2>
      <p className="mt-3 text-slate-500">复习 {run.completedMeanings} 个义项 · 完成 {run.completedRetries} 次再练</p>
      {run.unresolvedMeaningIds.length > 0 && <p className="mt-3 text-sm text-amber-700">还有 {run.unresolvedMeaningIds.length} 个义项需要巩固，已按掌握程度安排后续复习。</p>}
      {run.index < run.queue.length && <p className="mt-3 text-sm text-slate-500">未完成的内容可在下次复习时继续学习。</p>}
      <Link to="/review" className={`${LINK_CLASS} mt-6`}>返回模式选择</Link>
    </div>
  </>;
  const current = run.queue[run.index];
  return <>
    <PageHeader title={title} subtitle={current.retry > 0
      ? `错义项再练 ${current.retry} / ${MAX_RETRIES} · 本题 ${current.meanings.length} 个义项`
      : `第 ${run.completedWords + 1} / ${run.initialWordCount} 个单词 · 本题 ${current.meanings.length} 个义项`} />
    <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 p-3">
      <p className="text-sm font-medium text-brand-800">{resumed ? '已恢复上次进度' : '本轮进度自动保留'}</p>
      <p className="mt-1 text-xs leading-5 text-brand-700">忘记的义项尽量隔 3 个单词再练，每个义项最多再练 2 次。{current.retry > 0 ? '本题只练尚未记住的义项。' : ''}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link to="/review" className="inline-flex h-9 items-center rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-700">暂存退出</Link>
        <Button variant="ghost" size="sm" disabled={ending} onClick={() => void finish()}>{ending ? '结束中…' : '结束本轮'}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
    {mode === 'en-zh' ? <EnZhWordQuestion key={current.taskId} run={run} onSaved={setRun} />
      : <AdaptiveWordQuestion key={current.taskId} run={run} onSaved={setRun} />}
  </>;
}
