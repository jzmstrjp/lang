import { InlineLoadingSpinner } from '@/components/ui/loading-spinner';
import { StartButton } from '@/components/ui/start-button';

export default function Loading() {
  return (
    <StartButton error={null} disabled>
      <InlineLoadingSpinner />
      <span className="ml-2">問題を取得中...</span>
    </StartButton>
  );
}
