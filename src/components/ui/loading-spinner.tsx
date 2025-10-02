type LoadingSpinnerProps = {
  label?: string;
  className?: string;
};

export function LoadingSpinner({ label = 'Loading...', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-[#2a2b3c] ${className}`}>
      <span
        className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-[#2f8f9d]"
        aria-hidden="true"
      />
      <span className="text-sm font-medium" aria-live="polite">
        {label}
      </span>
    </div>
  );
}

type InlineLoadingSpinnerProps = {
  className?: string;
};

export function InlineLoadingSpinner({ className = '' }: InlineLoadingSpinnerProps) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent border-white ${className}`}
      aria-hidden="true"
    />
  );
}

export default LoadingSpinner;
