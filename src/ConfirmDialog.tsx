import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Resolver = (ok: boolean) => void;

const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

export const useConfirm = () => {
  const fn = useContext(ConfirmCtx);
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return fn;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(o);
    });
  }, []);

  const settle = (ok: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setOpts(null);
    r?.(ok);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && <ConfirmDialog opts={opts} onSettle={settle} />}
    </ConfirmCtx.Provider>
  );
};

const ConfirmDialog = ({
  opts,
  onSettle,
}: {
  opts: ConfirmOptions;
  onSettle: (ok: boolean) => void;
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSettle(false);
      if (e.key === 'Enter') onSettle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSettle]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSettle(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="modal panel">
        <h2 id="confirm-title" className="modal-title">
          {opts.title}
        </h2>
        {opts.body && <div className="modal-body">{opts.body}</div>}
        <div className="modal-actions">
          <button className="ghost" onClick={() => onSettle(false)}>
            {opts.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            className={opts.danger ? 'primary danger' : 'primary'}
            onClick={() => onSettle(true)}
          >
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
