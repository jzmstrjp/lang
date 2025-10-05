import { InlineLoadingSpinner } from '@/components/ui/loading-spinner';
import { StartButton } from '@/components/ui/start-button';

export default function Loading() {
  return (
    <div className="relative max-w-[720px] mx-auto">
      {/* 画像と同じアスペクト比（500x750 = 2:3）のプレースホルダー */}
      <div className="w-full aspect-[2/1.45] rounded-lg" />

      <div className="absolute inset-0 flex items-center justify-center">
        <StartButton error={null} disabled>
          <InlineLoadingSpinner />
          <span className="ml-2">問題を取得中...</span>
        </StartButton>
      </div>
    </div>
  );
}
