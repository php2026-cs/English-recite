interface ConfidencePickerProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  columnsClassName?: string;
}

const OPTIONS = [
  { value: 0, label: '😵 不太会' },
  { value: 1, label: '🤔 猜的' },
  { value: 2, label: '🙂 比较确定' },
  { value: 3, label: '😎 很确定' }
];

export function ConfidencePicker({
  value,
  onChange,
  disabled = false,
  columnsClassName = 'grid-cols-4'
}: ConfidencePickerProps) {
  return (
    <div className={`grid gap-2 ${columnsClassName}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-xl px-2 py-3 text-xs font-medium transition ${
            value === option.value
              ? 'bg-brand-600 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
