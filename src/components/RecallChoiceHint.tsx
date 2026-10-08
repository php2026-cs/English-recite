import { useEffect, useState } from 'react';
import type { ReviewRunItem } from '../core/reviewRun';
import { buildReviewChoices, type ReviewChoice } from '../core/reviewChoices';
import { Button } from './Button';

export function RecallChoiceHint({ item, direction, used, onUse, onChoose, target }: {
  item: ReviewRunItem; direction: 'en-zh' | 'zh-en'; used: boolean;
  onUse: () => void; onChoose: (option: ReviewChoice) => void; target?: string;
}) {
  const [options, setOptions] = useState<ReviewChoice[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!used) return;
    let active = true;
    setError('');
    void import('../services/lexicon/localLexicon').then(({ localLexicon }) => {
      if (active) setOptions(buildReviewChoices(item, direction, localLexicon.list()));
    }).catch(() => { if (active) setError('提示加载失败，可以继续输入或重试。'); });
    return () => { active = false; };
  }, [used, item, direction, attempt]);
  if (!used) return <Button variant="secondary" className="mt-4 w-full" onClick={onUse}>给我选项</Button>;
  return <section aria-label="回忆提示" className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
    <p className="text-sm font-semibold text-brand-800">已使用提示 · 本题不会计为独立掌握</p>
    <p className="mt-1 text-xs leading-5 text-slate-600">{direction === 'en-zh'
      ? `点击选项填入${target ?? '当前空格'}，也可先点击其他输入框。选项中含有干扰项。`
      : '点击选项填入英文，也可以继续修改。选项中含有干扰项。'}</p>
    {options.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {options.map((option, index) => <button key={option.id} type="button"
        className="choice-option rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-900"
        onClick={() => onChoose(option)}>
        <span className="mr-2 text-brand-700">{String.fromCharCode(65 + index)}</span>{option.label}
      </button>)}
    </div> : <p className="mt-3 text-sm" role={error ? 'alert' : 'status'}>{error || '正在准备选项…'}</p>}
    {error && <Button className="mt-2" size="sm" variant="secondary" onClick={() => setAttempt(value => value + 1)}>重试提示</Button>}
  </section>;
}
