import { Suspense } from 'react';
import { HeaderPortal } from '@/components/layout/header-portal';
import PatternLearningFlow from '@/components/pattern/pattern-learning-flow';
import { InlineLoadingSpinner } from '@/components/ui/loading-spinner';
import { StartButton } from '@/components/ui/start-button';
import { fetchRandomPatternSet } from '@/lib/pattern-service';

// データ取得部分を別コンポーネントに分離
async function PatternLearningContent() {
  const patternSet = await fetchRandomPatternSet();

  if (!patternSet) {
    return (
      <p className="mt-10 text-sm text-rose-500 text-center">
        パターンセットが見つかりませんでした。
      </p>
    );
  }

  return <PatternLearningFlow initialPatternSet={patternSet} />;
}

// Loading コンポーネント
function LoadingFallback() {
  return (
    <StartButton error={null} disabled>
      <InlineLoadingSpinner />
      <span className="ml-2">データを準備中...</span>
    </StartButton>
  );
}

export default function PatternLearningPage() {
  return (
    <>
      <HeaderPortal>Kids</HeaderPortal>
      <Suspense fallback={<LoadingFallback />}>
        <PatternLearningContent />
      </Suspense>
    </>
  );
}
