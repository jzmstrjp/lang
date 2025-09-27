import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow from '@/components/problem/problem-flow';

export default function ShortProblemPage() {
  return (
    <>
      <HeaderPortal>Short</HeaderPortal>
      <ProblemFlow length="short" />
    </>
  );
}
