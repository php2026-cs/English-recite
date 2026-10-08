import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { settingsRepository } from '../repositories/settingsRepository';
import type { ReviewFlow } from '../core/reviewRun';

const FLOWS: Array<{ value: ReviewFlow; title: string; description: string }> = [
  { value: 'two-rounds', title: '先选后填', description: '保持原来的两轮练习，先辨认，再输入。' },
  { value: 'recall-first', title: '直接回忆', description: '先输入，想不起来时再点“给我选项”。' }
];

export function ReviewFlowPicker() {
  const settings = useLiveQuery(() => settingsRepository.get(), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function select(reviewFlow: ReviewFlow) {
    setSaving(true); setError('');
    try { await settingsRepository.update({ reviewFlow }); }
    catch { setError('练习方式保存失败，请重试。'); }
    finally { setSaving(false); }
  }
  return <fieldset disabled={saving || !settings} className="mb-5 min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
    <legend className="px-2 text-base font-semibold text-slate-900">练习方式（可选）</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {FLOWS.map(flow => <label key={flow.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
        (settings?.reviewFlow ?? 'two-rounds') === flow.value ? 'border-brand-600 bg-brand-50' : 'border-slate-200'}`}>
        <input type="radio" name="review-flow" className="mt-1" value={flow.value}
          checked={(settings?.reviewFlow ?? 'two-rounds') === flow.value}
          onChange={() => void select(flow.value)} />
        <span><span className="block font-semibold text-slate-900">{flow.title}</span>
          <span className="mt-1 block text-sm leading-6 text-slate-500">{flow.description}</span></span>
      </label>)}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">不选也可以，默认先选后填。更改对新一轮生效，已暂存的复习保持原方式。</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </fieldset>;
}
