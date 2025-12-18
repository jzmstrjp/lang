import { PropsWithChildren } from 'react';

type StartButtonProps = {
  error: string | null;
  disabled?: boolean;
  handleStart?: () => void;
  autoFocus?: boolean;
};

export const StartButton = ({
  error,
  disabled = false,
  handleStart,
  autoFocus = false,
  children,
}: PropsWithChildren<StartButtonProps>) => {
  return (
    <div className="flex flex-col items-center gap-4 text-center bg-[var(--background)] py-8 px-4 rounded-lg w-[300px] border border-[var(--start-button-border)]">
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      <button
        key={disabled ? 'disabled' : 'enabled'}
        autoFocus={autoFocus}
        type="button"
        onClick={handleStart}
        className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-lg font-semibold text-[var(--primary-text)] shadow-lg shadow-[var(--primary)]/30 transition enabled:hover:bg-[var(--primary-hover)] disabled:opacity-60"
        disabled={disabled}
      >
        {children}
      </button>
      <p
        className={`text-base text-[var(--text-muted)] mt-2 ${disabled ? 'invisible' : 'visible'}`}
      >
        ※音が出ます
      </p>
    </div>
  );
};
