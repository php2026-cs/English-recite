import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { wordRepository } from '../repositories/wordRepository';
import { useAuth } from '../auth/AuthContext';
import type { WordWithMeanings } from '../types';

export function WordListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<WordWithMeanings | null>(null);
  const words = useLiveQuery(
    () => wordRepository.list(search),
    [search, user?.id ?? null],
    []
  );

  async function confirmDelete() {
    if (!pendingDelete) return;
    await wordRepository.remove(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <>
      <PageHeader
        title="词库"
        subtitle="搜索、编辑或删除已保存的单词。"
        action={
          <Link to="/words/new">
            <Button size="sm">添加单词</Button>
          </Link>
        }
      />

      <div className="mb-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索英文单词"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {words && words.length === 0 ? (
        <EmptyState
          icon="📖"
          title={search ? '没有找到匹配的单词' : '词库还是空的'}
          description={search ? '换个关键词试试。' : '添加第一个单词，开始积累你的词库。'}
          action={
            search ? undefined : (
              <Link to="/words/new">
                <Button>添加第一个单词</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {words?.map((word) => {
            const selectedCount = word.meanings.filter((meaning) => meaning.selectedForStudy).length;
            return (
              <div
                key={word.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Link to={`/words/${word.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-slate-900">
                    {word.word}
                    {word.phonetic ? (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {word.phonetic}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {word.meanings.length} 个释义 · {selectedCount} 个正在背诵
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(word)}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  删除
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除单词？"
        description={
          pendingDelete
            ? `将删除“${pendingDelete.word}”及其所有释义和复习记录，此操作无法撤销。`
            : ''
        }
        confirmText="删除"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
