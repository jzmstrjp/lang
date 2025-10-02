import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';

const validTypes = ['short', 'medium', 'long'] as const;

export default async function ProblemPage({ params }: { params: { type: string } }) {
  const { type } = await params;

  // 無効なtypeの場合は404
  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  const displayName = type;

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <ProblemFlow length={type as ProblemLength} />
    </>
  );
}
