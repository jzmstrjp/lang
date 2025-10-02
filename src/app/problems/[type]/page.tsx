import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import LoadingSpinner from '@/components/ui/loading-spinner';

const validTypes = ['short', 'medium', 'long'] as const;

export default function ProblemPage({ params }: { params: { type: string } }) {
  const type = params.type;

  // 無効なtypeの場合は404
  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  const displayName = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <Suspense fallback={<LoadingSpinner label="問題を読み込み中..." />}>
        <ProblemFlow length={type as ProblemLength} />
      </Suspense>
    </>
  );
}
