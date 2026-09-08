import { PART_OF_SPEECH_OPTIONS } from '../types';

interface PosInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function PosInput({ value, onChange, id = 'part-of-speech' }: PosInputProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        词性
      </label>
      <input
        id={id}
        list={`${id}-options`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="例如：v. 或 phrasal verb"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <datalist id={`${id}-options`}>
        {PART_OF_SPEECH_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
