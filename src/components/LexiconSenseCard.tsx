import type { LexiconSense } from '../data/lexicon/types';

interface LexiconSenseCardProps {
  sense: LexiconSense;
  selected: boolean;
  onToggle: (sense: LexiconSense) => void;
}

export function LexiconSenseCard({
  sense,
  selected,
  onToggle
}: LexiconSenseCardProps) {
  return (
    <div
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200"
      onClick={() => onToggle(sense)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle(sense);
        }
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(sense)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`${sense.partOfSpeech} ${sense.chineseMeaning}`}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {sense.partOfSpeech}
        </div>
        <p className="mt-1 break-words text-base leading-6 text-slate-900">
          {sense.chineseMeaning}
        </p>
        {sense.aliases && sense.aliases.length > 0 ? (
          <p className="mt-1 text-xs text-slate-400">
            近义：{sense.aliases.join('、')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
