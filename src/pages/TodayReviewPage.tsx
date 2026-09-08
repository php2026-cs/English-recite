import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { normalizeEnglish } from '../lib/strings';
import { meaningRepository } from '../repositories/meaningRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { wordRepository } from '../repositories/wordRepository';
import { buildReviewQueue, type ReviewQueueItem } from '../services/srs/reviewQueue';
import { reviewStateRepository } from '../services/srs/reviewState';
import { submitZhEnReview } from '../services/srs/srsReviewService';
import type { ReviewRating } from '../types';
import { useAuth } from '../auth/AuthContext';

const RATING_OPTIONS: Array<{ rating: ReviewRating; label: string; key: string }> = [
  { rating: 'again', label: 'Again', key: '1' },
  { rating: 'hard', label: 'Hard', key: '2' },
  { rating: 'good', label: 'Good', key: '3' },
  { rating: 'easy', label: 'Easy', key: '4' }
];

export function TodayReviewPage() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const words = useLiveQuery(() => wordRepository.list(), [ownerId]);
  const meanings = useLiveQuery(() => meaningRepository.listSelected(), [ownerId]);
  const reviewStates = useLiveQuery(() => reviewStateRepository.list(), [ownerId]);
  const settings = useLiveQuery(() => settingsRepository.get(), [ownerId]);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<null | { correct: boolean }>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!words || !meanings || !reviewStates || !settings) return;
    setQueue(
      buildReviewQueue(words, meanings, reviewStates, {
        dailyNewMeaningLimit: settings.dailyNewMeaningLimit
      })
    );
  }, [words, meanings, reviewStates, settings]);

  useEffect(() => {
    if (!status || saving) return;
    function handleKeyDown(event: KeyboardEvent) {
      const option = RATING_OPTIONS.find((item) => item.key === event.key);
      if (option) {
        event.preventDefault();
        void handleRating(option.rating);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void handleRating(status?.correct ? 'good' : 'again');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, saving]);

  const current = queue[index];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || status || finished || !input.trim()) return;
    setStatus({
      correct: normalizeEnglish(input) === normalizeEnglish(current.word)
    });
  }

  async function handleRating(rating: ReviewRating) {
    if (!current || !status || saving) return;
    setSaving(true);
    try {
      const word = words?.find((item) => item.id === current.wordId);
      if (word) {
        await submitZhEnReview({
          word,
          meaning: current.meaning,
          rating
        });
      }
      if (rating !== 'again') setCorrectCount((count) => count + 1);
      next();
    } finally {
      setSaving(false);
    }
  }

  function next() {
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      setFinished(true);
      return;
    }
    setIndex(nextIndex);
    setInput('');
    setStatus(null);
  }

  function retry() {
    setInput('');
    setStatus(null);
  }

  if (queue.length === 0 && words && meanings && reviewStates) {
    return (
      <>
        <PageHeader title="今日复习" />
        <EmptyState
          icon="✅"
          title="今天没有待复习的义项"
          description="已经全部完成，或者还没有加入背诵的释义。"
          action={
            <Link to="/words" className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              去词库
            </Link>
          }
        />
      </>
    );
  }

  if (finished) {
    return (
      <>
        <PageHeader title="今日复习" subtitle="本轮完成。" />
        <div className="rounded-3xl bg-white p-8 text-center shadow-soft">
          <div className="text-5xl">🎉</div>
          <div className="mt-4 text-2xl font-semibold text-slate-900">
            答对 {correctCount} / {queue.length}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => window.location.reload()}>刷新队列</Button>
            <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
              返回首页
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!current) return null;

  return (
    <>
      <PageHeader
        title="今日复习"
        subtitle={`第 ${index + 1} / ${queue.length} 个义项 · 已答对 ${correctCount}`}
      />
      <div className="rounded-3xl bg-white p-6 shadow-soft">
        <div className="text-sm font-semibold text-brand-700">{current.meaning.partOfSpeech}</div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {current.meaning.chineseMeaning}
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <label htmlFor="today-answer" className="mb-2 block text-sm font-medium text-slate-700">
            英文单词
          </label>
          <input
            id="today-answer"
            autoFocus={!status}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={status !== null}
            placeholder="输入英文"
            autoCapitalize="none"
            autoCorrect="off"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-lg outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
          />

          {status === null ? (
            <Button type="submit" disabled={!input.trim()} className="mt-4 w-full">
              提交
            </Button>
          ) : (
            <div className={`mt-4 rounded-xl p-4 ${status.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {status.correct ? (
                <div className="font-medium">✓ 正确</div>
              ) : (
                <div>
                  <div className="font-medium">正确答案</div>
                  <div className="mt-1 text-2xl font-semibold">{current.word}</div>
                </div>
              )}
            </div>
          )}
        </form>

        {status !== null ? (
          <div className="mt-4">
            <div className="grid grid-cols-4 gap-2">
              {RATING_OPTIONS.map((option) => (
                <Button
                  key={option.rating}
                  variant={option.rating === (status.correct ? 'good' : 'again') ? 'primary' : 'secondary'}
                  disabled={saving}
                  onClick={() => void handleRating(option.rating)}
                  className="px-2"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="mt-3 flex gap-3">
              {!status.correct ? (
                <Button variant="secondary" onClick={retry} className="flex-1">
                  再来一次
                </Button>
              ) : null}
              <Button
                onClick={() => void handleRating(status.correct ? 'good' : 'again')}
                disabled={saving}
                className="flex-1"
              >
                下一题
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">
              快捷键 1 Again · 2 Hard · 3 Good · 4 Easy · Enter 默认评分
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
