import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { meaningRepository } from '../repositories/meaningRepository';
import { wordRepository } from '../repositories/wordRepository';
import { reviewStateRepository } from '../services/srs/reviewState';
import { countQueueItems } from '../services/srs/reviewQueue';

export function HomePage() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const stats = useLiveQuery(() => wordRepository.getStats(), [ownerId]);
  const words = useLiveQuery(() => wordRepository.list(), [ownerId]);
  const selectedMeanings = useLiveQuery(() => meaningRepository.listSelected(), [ownerId]);
  const reviewStates = useLiveQuery(() => reviewStateRepository.list(), [ownerId]);
  const queueCounts =
    words && selectedMeanings && reviewStates
      ? countQueueItems(words, selectedMeanings, reviewStates)
      : { due: 0, new: 0, total: 0, overdue: 0 };

  return (
    <>
      <PageHeader
        title="今天背点什么？"
        subtitle="轻量、本地优先，每个义项都单独记忆。"
      />

      {!user ? (
        <Link
          to="/login"
          className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200"
        >
          <span className="text-sm text-slate-600">云同步未开启</span>
          <span className="text-sm font-medium text-brand-700">
            登录以启用多设备同步
          </span>
        </Link>
      ) : null}

      <section className="rounded-3xl bg-brand-700 p-6 text-white shadow-soft">
        <div className="text-sm text-brand-100">今日待复习</div>
        <div className="mt-2 text-5xl font-semibold tracking-tight">
          {queueCounts.total}
        </div>
        <div className="mt-1 text-sm text-brand-100">
          新义项 {queueCounts.new} · 复习 {queueCounts.due}
          {queueCounts.overdue > 0 ? ` · 逾期 ${queueCounts.overdue}` : ''}
        </div>
        <div className="mt-6">
          <Link
            to="/review/today"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-base font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 sm:w-auto"
          >
            开始背诵
          </Link>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/words"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200"
        >
          <div className="text-2xl font-semibold text-slate-900">{stats?.wordCount ?? 0}</div>
          <div className="mt-1 text-sm text-slate-500">个单词</div>
        </Link>
        <Link
          to="/words/new"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200"
        >
          <div>
            <div className="text-2xl font-semibold text-slate-900">
              {stats?.meaningCount ?? 0}
            </div>
            <div className="mt-1 text-sm text-slate-500">个释义</div>
          </div>
          <span className="text-brand-700">＋</span>
        </Link>
      </section>

      <Link
        to="/lexicon/cet6"
        className="mt-4 block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">六级词库</div>
            <div className="mt-1 text-sm text-slate-500">本地离线 CET6 词典</div>
          </div>
          <span className="text-brand-700">→</span>
        </div>
      </Link>

      <div className="mt-8">
        <Link to="/words/new">
          <Button variant="secondary" className="w-full">
            添加单词
          </Button>
        </Link>
      </div>
    </>
  );
}
