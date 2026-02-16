import { Suspense, use } from 'react';
import { HeaderPortal } from '@/components/layout/header-portal';
import FillBlankFlow from '@/components/fill-blank/fill-blank-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { fetchProblems } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';

type ProblemData = ProblemWithAudio | null;

function loadInitialProblem(): Promise<ProblemData> {
  return (async () => {
    // 難易度フィルタなしで全問題から1件取得
    const { problems } = await fetchProblems({
      limit: 1,
    });
    return problems[0] ?? null;
  })();
}

function FillBlankContent({
  initialProblemPromise,
}: {
  initialProblemPromise: Promise<ProblemData>;
}) {
  const initialProblem = use(initialProblemPromise);

  if (!initialProblem) {
    return <p className="mt-10 text-sm text-rose-500 text-center">問題が見つかりませんでした。</p>;
  }

  return <FillBlankFlow initialProblem={initialProblem} />;
}

export default async function FillBlankPage() {
  const initialProblemPromise = loadInitialProblem();

  return (
    <>
      <HeaderPortal>ana-ume</HeaderPortal>
      <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
        <FillBlankContent initialProblemPromise={initialProblemPromise} />
      </Suspense>
    </>
  );
}
