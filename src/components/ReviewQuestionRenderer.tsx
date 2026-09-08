import type { ReviewQuestion } from '../core/adaptiveReview';

interface ReviewQuestionRendererProps {
  question: ReviewQuestion;
  answer: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function ReviewQuestionRenderer({
  question,
  answer,
  disabled = false,
  onChange,
  onSubmit
}: ReviewQuestionRendererProps) {
  const prompt = question.prompt;

  function renderPrompt() {
    switch (question.questionType) {
      case 'en-to-zh':
        return (
          <>
            <div className="text-3xl font-semibold tracking-tight text-slate-900">
              {prompt.word}
            </div>
            {prompt.phonetic ? (
              <div className="mt-1 text-sm text-slate-400">{prompt.phonetic}</div>
            ) : null}
          </>
        );
      case 'zh-to-en':
      case 'spelling':
        return (
          <>
            <div className="text-sm font-semibold text-brand-700">
              {prompt.partOfSpeech}
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {prompt.chineseMeaning}
            </div>
            {prompt.phonetic ? (
              <div className="mt-1 text-sm text-slate-400">{prompt.phonetic}</div>
            ) : null}
          </>
        );
      case 'context':
        return (
          <div className="text-xl leading-9 text-slate-900">
            {prompt.context}
          </div>
        );
      default:
        return (
          <div className="text-3xl font-semibold tracking-tight text-slate-900">
            {prompt.chineseMeaning}
          </div>
        );
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="mt-6"
    >
      {renderPrompt()}
      <label className="mb-2 mt-7 block text-sm font-medium text-slate-700">
        你的答案
      </label>
      <input
        autoFocus
        value={answer}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          question.questionType === 'en-to-zh' ? '输入中文释义' : '输入英文'
        }
        autoCapitalize="none"
        autoCorrect="off"
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-lg outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
      />
    </form>
  );
}
