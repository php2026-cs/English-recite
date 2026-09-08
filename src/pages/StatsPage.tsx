import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { downloadJson, exportPayload, importPayload, type ImportMode } from '../core/importExport';
import { reviewRepository } from '../repositories/reviewRepository';
import { wordRepository } from '../repositories/wordRepository';
import { useAuth } from '../auth/AuthContext';

export function StatsPage() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const library = useLiveQuery(() => wordRepository.getStats(), [ownerId]);
  const review = useLiveQuery(() => reviewRepository.getSummary(), [ownerId]);
  const today = useLiveQuery(() => reviewRepository.getTodaySummary(), [ownerId]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const accuracy =
    review && review.totalReviews > 0
      ? Math.round((review.correctCount / review.totalReviews) * 100)
      : 0;

  async function handleExport() {
    const payload = await exportPayload();
    downloadJson(payload);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed: unknown = JSON.parse(text);
      setPendingImport(parsed);
    } catch {
      setImportMessage('文件不是有效的 JSON，请重新选择。');
    } finally {
      event.target.value = '';
    }
  }

  async function handleImport(mode: ImportMode) {
    if (pendingImport === null) return;
    try {
      const result = await importPayload(pendingImport, mode);
      setImportMessage(
        `导入完成：${result.importedWords} 个单词，${result.importedMeanings} 个释义。`
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '导入失败，请检查文件格式。');
    } finally {
      setPendingImport(null);
    }
  }

  return (
    <>
      <PageHeader title="统计" subtitle="简单记录你的积累与复习情况。" />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="单词" value={library?.wordCount ?? 0} />
        <StatCard label="释义" value={library?.meaningCount ?? 0} />
        <StatCard label="正在背诵" value={library?.selectedMeaningCount ?? 0} />
        <StatCard label="已复习义项" value={review?.reviewedMeaningCount ?? 0} />
        <StatCard label="答对" value={review?.correctCount ?? 0} tone="good" />
        <StatCard label="答错" value={review?.incorrectCount ?? 0} tone="bad" />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">今天</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-6">
          <StatCard label="复习义项" value={today?.total ?? 0} />
          <StatCard label="正确率" value={today?.total ? Math.round((today.correct / today.total) * 100) : 0} suffix="%" />
          <StatCard label="Again" value={today?.again ?? 0} tone="bad" />
          <StatCard label="Hard" value={today?.hard ?? 0} />
          <StatCard label="Good" value={today?.good ?? 0} tone="good" />
          <StatCard label="Easy" value={today?.easy ?? 0} tone="good" />
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">总正确率</span>
          <span className="text-xl font-semibold text-slate-900">{accuracy}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${accuracy}%` }}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">数据备份</h2>
        <p className="mt-1 text-sm text-slate-500">
          导出或导入 JSON，方便备份你的本地词库。
        </p>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" onClick={handleExport}>
            导出 JSON
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            导入 JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        {importMessage ? (
          <p className="mt-3 text-sm text-slate-600">{importMessage}</p>
        ) : null}
      </div>

      <Modal
        open={pendingImport !== null}
        title="选择导入方式"
        onClose={() => setPendingImport(null)}
      >
        <p className="text-sm text-slate-600">
          覆盖会清空当前数据；合并会保留当前数据，并追加导入内容。
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={() => handleImport('merge')} className="flex-1">
            合并数据
          </Button>
          <Button variant="danger" onClick={() => handleImport('overwrite')} className="flex-1">
            覆盖数据
          </Button>
        </div>
      </Modal>
    </>
  );
}

function StatCard({
  label,
  value,
  tone = 'default',
  suffix = ''
}: {
  label: string;
  value: number;
  tone?: 'default' | 'good' | 'bad';
  suffix?: string;
}) {
  const color =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>
        {value}
        {suffix}
      </div>
    </div>
  );
}
