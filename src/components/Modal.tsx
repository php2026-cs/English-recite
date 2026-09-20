import { useEffect, useState, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) { setPresent(true); return; }
    const timeout = window.setTimeout(() => setPresent(false), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    return () => window.clearTimeout(timeout);
  }, [open]);
  if (!open && !present) return null;

  return (
    <div
      className={`modal-motion fixed inset-0 z-40 flex items-end justify-center bg-slate-900/25 p-4 sm:items-center ${open ? '' : 'is-closing'}`}
      aria-hidden={!open}
      ref={element => { if (element) element.inert = !open; }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
