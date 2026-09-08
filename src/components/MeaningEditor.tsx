import { useState, type FormEvent } from 'react';
import type { MeaningInput } from '../repositories/meaningRepository';
import { Button } from './Button';
import { PosInput } from './PosInput';

interface MeaningEditorProps {
  initialValue?: MeaningInput;
  submitText?: string;
  onCancel?: () => void;
  onSubmit: (value: MeaningInput) => void;
}

export function MeaningEditor({
  initialValue,
  submitText = '保存',
  onCancel,
  onSubmit
}: MeaningEditorProps) {
  const [partOfSpeech, setPartOfSpeech] = useState(initialValue?.partOfSpeech ?? 'v.');
  const [chineseMeaning, setChineseMeaning] = useState(initialValue?.chineseMeaning ?? '');
  const [selectedForStudy, setSelectedForStudy] = useState(
    initialValue?.selectedForStudy ?? true
  );

  const canSubmit = partOfSpeech.trim().length > 0 && chineseMeaning.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      partOfSpeech: partOfSpeech.trim(),
      chineseMeaning: chineseMeaning.trim(),
      selectedForStudy
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PosInput value={partOfSpeech} onChange={setPartOfSpeech} />
      <div>
        <label htmlFor="chinese-meaning" className="mb-1.5 block text-sm font-medium text-slate-700">
          中文意思
        </label>
        <input
          id="chinese-meaning"
          autoFocus
          value={chineseMeaning}
          onChange={(event) => setChineseMeaning(event.target.value)}
          placeholder="例如：收费"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
        <input
          type="checkbox"
          checked={selectedForStudy}
          onChange={(event) => setSelectedForStudy(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-slate-700">加入背诵范围</span>
      </label>
      <div className="flex justify-end gap-3 pt-1">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        ) : null}
        <Button type="submit" disabled={!canSubmit}>
          {submitText}
        </Button>
      </div>
    </form>
  );
}
