import { Suspense } from 'react';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow from '@/components/problem/problem-flow';

export default function MediumProblemPage() {
  return (
    <>
      <HeaderPortal>Medium</HeaderPortal>
      <Suspense fallback={<div>Loading...</div>}>
        <ProblemFlow length="medium" />
      </Suspense>
    </>
  );
}
