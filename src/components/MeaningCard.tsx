import type { Meaning } from '../types';

interface MeaningCardProps {
  meaning: Meaning;
  onToggleSelected: (meaning: Meaning) => void;
  onEdit: (meaning: Meaning) => void;
  onDelete: (meaning: Meaning) => void;
}

export function MeaningCard({
  meaning,
  onToggleSelected,
  onEdit,
  onDelete
}: MeaningCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <input
        type="checkbox"
        checked={meaning.selectedForStudy}
        onChange={() => onToggleSelected(meaning)}
        aria-label={`${meaning.partOfSpeech} ${meaning.chineseMeaning} 是否加入背诵`}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {meaning.partOfSpeech}
        </div>
        <p className="mt-1 break-words text-base leading-6 text-slate-900">
          {meaning.chineseMeaning}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onEdit(meaning)}
          className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => onDelete(meaning)}
          className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          删除
        </button>
      </div>
    </div>
  );
}
