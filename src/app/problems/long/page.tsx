import { Suspense } from 'react';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow from '@/components/problem/problem-flow';

export default function LongProblemPage() {
  return (
    <>
      <HeaderPortal>Long</HeaderPortal>
      <Suspense fallback={<div>Loading...</div>}>
        <ProblemFlow length="long" />
      </Suspense>
    </>
  );
}
