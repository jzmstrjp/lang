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
    <div className="flex flex-col items-center gap-4 text-center bg-white p-8 rounded-lg min-w-[80%] sm:min-w-[300px]">
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <button
        type="button"
        onClick={handleStart}
        className="inline-flex items-center justify-center rounded-full bg-[#2f8f9d] px-6 py-3 text-lg font-semibold text-[#f4f1ea] shadow-lg shadow-[#2f8f9d]/30 transition enabled:hover:bg-[#257682] disabled:opacity-60"
        disabled={disabled}
      >
        {children}
      </button>
      <p className={`text-base text-[#666] mt-2 ${disabled ? 'invisible' : 'visible'}`}>
        ※音が出ます
      </p>
    </div>
  );
};
