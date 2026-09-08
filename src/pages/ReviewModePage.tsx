import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { meaningRepository } from '../repositories/meaningRepository';
import { wordRepository } from '../repositories/wordRepository';
import { useAuth } from '../auth/AuthContext';
import { db } from '../db/db';

export function ReviewModePage() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const words = useLiveQuery(() => wordRepository.list(), [ownerId]);
  const selectedMeanings = useLiveQuery(() => meaningRepository.listSelected(), [ownerId]);
  const activeRuns = useLiveQuery(() => db.activeReviewRuns
    .filter((run) => run.localOwnerUserId === ownerId && run.status === 'active').toArray(), [ownerId]);
  const wordCount = words?.length ?? 0;
  const meaningCount = selectedMeanings?.length ?? 0;

  if (wordCount === 0 || meaningCount === 0) {
    return (
      <>
        <PageHeader title="背诵" subtitle="选择一种模式开始记忆。" />
        <EmptyState
          icon="🃏"
          title={wordCount === 0 ? '还没有单词' : '还没有加入背诵的释义'}
          description={
            wordCount === 0
              ? '先添加一个单词，并给它增加中文释义。'
              : '在词库中勾选你想要背诵的释义。'
          }
          action={
            wordCount === 0 ? (
              <Link to="/words/new" className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
                添加单词
              </Link>
            ) : (
              <Link to="/words" className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
                去勾选释义
              </Link>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="背诵" subtitle={`当前有 ${meaningCount} 个释义可以进入复习。`} />
      <div className="space-y-4">
        <Link
          to="/review/adaptive"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200"
        >
          <div className="text-xl font-semibold text-slate-900">智能复习</div>
          <p className="mt-1 text-sm text-slate-500">{activeRuns?.some((run) => run.mode === 'adaptive') ? '继续上次复习 · 已保留答案和进度' : '根据你的表现自动选择题型和难度。'}</p>
        </Link>
        <Link
          to="/review/zh-en"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200"
        >
          <div className="text-xl font-semibold text-slate-900">中译英</div>
          <p className="mt-1 text-sm text-slate-500">{activeRuns?.some((run) => run.mode === 'zh-en') ? '继续上次复习 · 已保留答案和进度' : '看中文意思和词性，写出英文单词。'}</p>
        </Link>
        <Link
          to="/review/en-zh"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200"
        >
          <div className="text-xl font-semibold text-slate-900">英译中</div>
          <p className="mt-1 text-sm text-slate-500">{activeRuns?.some((run) => run.mode === 'en-zh') ? '继续上次复习 · 已保留答案和进度' : '看英文单词，逐个回忆它的一词多义。'}</p>
        </Link>
      </div>
    </>
  );
}
