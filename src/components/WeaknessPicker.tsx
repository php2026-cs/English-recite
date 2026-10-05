import { useState } from 'react';
import { WEAKNESS_LABELS, type StudyWeakness } from '../core/studySupport';

export function WeaknessPicker({ value, onChange }: { value: StudyWeakness[]; onChange: (value: StudyWeakness[]) => void }) {
  const [open, setOpen] = useState(value.length > 0);
  return <div className="my-3 rounded-lg border border-slate-200 p-3">
    <button type="button" className="w-full text-left text-sm font-medium text-slate-700" aria-expanded={open} onClick={() => setOpen(!open)}>
      薄弱点（可选） · {value.length ? `已标记 ${value.length} 项` : '不标记也可以'} {open ? '−' : '＋'}
    </button>
    {open && <fieldset className="mt-3">
      <legend className="sr-only">薄弱点，可多选，也可全部不选</legend>
      <div className="flex flex-wrap gap-2">{Object.entries(WEAKNESS_LABELS).map(([key, label]) => {
        const weakness = key as StudyWeakness;
        return <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value.includes(weakness) ? 'border-brand-300 bg-brand-50' : 'border-slate-200'}`}>
          <input type="checkbox" checked={value.includes(weakness)} onChange={() => onChange(value.includes(weakness) ? value.filter(item => item !== weakness) : [...value, weakness])} />{label}
        </label>;
      })}</div>
      {value.length > 0 && <button type="button" className="mt-3 text-xs text-slate-500 underline" onClick={() => onChange([])}>清空标记</button>}
    </fieldset>}
  </div>;
}
