import { PropsWithChildren } from 'react';

type StartButtonProps = {
  error: string | null;
  disabled?: boolean;
  handleStart?: () => void;
};

export const StartButton = ({
  error,
  disabled = false,
  handleStart,
  children,
}: PropsWithChildren<StartButtonProps>) => {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 text-center bg-[var(--background)] p-8 rounded-lg min-w-[80%] sm:min-w-[300px]">
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      <button
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
