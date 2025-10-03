import { InlineLoadingSpinner } from '@/components/ui/loading-spinner';
import { StartButton } from '@/components/ui/start-button';

export default function Loading() {
  return (
    <StartButton error={null} disabled>
      <InlineLoadingSpinner />
      <span className="ml-2">パターン学習を準備中...</span>
    </StartButton>
  );
}
