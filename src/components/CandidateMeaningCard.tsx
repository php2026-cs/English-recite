import { useState } from 'react';
import type { CandidateMeaning } from '../services/dictionary/candidates';
import { isLongChineseMeaning } from '../services/dictionary/meaningNormalizer';

interface CandidateMeaningCardProps {
  candidate: CandidateMeaning;
  onToggle: (candidate: CandidateMeaning) => void;
  onEdit: (candidate: CandidateMeaning) => void;
  onDelete: (candidate: CandidateMeaning) => void;
}

export function CandidateMeaningCard({
  candidate,
  onToggle,
  onEdit,
  onDelete
}: CandidateMeaningCardProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const hasExplanation = Boolean(
    candidate.sourceDefinition || candidate.translatedDefinition
  );

  function handleCardClick() {
    onToggle(candidate);
  }

  return (
    <div
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle(candidate);
        }
      }}
    >
      <input
        type="checkbox"
        checked={candidate.selectedForStudy}
        onChange={() => onToggle(candidate)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`${candidate.partOfSpeech} ${candidate.chineseMeaning} 是否加入背诵`}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {candidate.partOfSpeech}
        </div>
        <p className="mt-1 break-words text-base leading-6 text-slate-900">
          {candidate.chineseMeaning}
        </p>
        {candidate.chineseMeaning &&
        isLongChineseMeaning(candidate.chineseMeaning) ? (
          <p className="mt-1 text-xs text-amber-600">候选释义较长，建议精简后保存。</p>
        ) : null}
        {hasExplanation ? (
          <div className="mt-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setExplanationOpen((current) => !current)}
              className="text-xs font-medium text-brand-700 hover:text-brand-600"
            >
              {explanationOpen ? '收起解释' : '查看解释'}
            </button>
            {explanationOpen ? (
              <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                {candidate.sourceDefinition ? (
                  <div>
                    <div className="font-medium text-slate-700">英文解释</div>
                    <div>{candidate.sourceDefinition}</div>
                  </div>
                ) : null}
                {candidate.translatedDefinition ? (
                  <div>
                    <div className="font-medium text-slate-700">机器翻译</div>
                    <div>{candidate.translatedDefinition}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        className="flex shrink-0 gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onEdit(candidate)}
          className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => onDelete(candidate)}
          className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          删除
        </button>
      </div>
    </div>
  );
}
