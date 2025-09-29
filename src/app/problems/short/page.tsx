import { Suspense } from 'react';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow from '@/components/problem/problem-flow';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function ShortProblemPage() {
  return (
    <>
      <HeaderPortal>Short</HeaderPortal>
      <Suspense fallback={<LoadingSpinner label="問題を読み込み中..." />}>
        <ProblemFlow length="short" />
      </Suspense>
    </>
  );
}
