import { InlineLoadingSpinner } from '@/components/ui/loading-spinner';
import { StartButton } from '@/components/ui/start-button';

type ProblemLoadingPlaceholderProps = {
  message: string;
};

export function ProblemLoadingPlaceholder({ message }: ProblemLoadingPlaceholderProps) {
  return (
    <div className="relative w-[1000px] max-w-full mx-auto">
      <div className="w-full aspect-[4/3] rounded-lg" />

      <div className="absolute inset-0 flex items-center justify-center">
        <StartButton error={null} disabled>
          <InlineLoadingSpinner />
          <span className="ml-2">{message}</span>
        </StartButton>
      </div>
    </div>
  );
}
