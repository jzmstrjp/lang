import { Suspense } from 'react';
import { HeaderPortal } from '@/components/layout/header-portal';
import FillBlankFlow from '@/components/fill-blank/fill-blank-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { fetchProblems } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';

type ProblemData = ProblemWithAudio | null;

type FillBlankPageProps = {
  searchParams: Promise<{ search?: string }>;
};

function loadInitialProblem({ searchQuery }: { searchQuery?: string }): Promise<ProblemData> {
  return (async () => {
    // 難易度フィルタなしで全問題から1件取得
    const { problems } = await fetchProblems({
      limit: 1,
      search: searchQuery,
    });
    return problems[0] ?? null;
  })();
}

async function FillBlankContent({
  searchQuery,
  initialProblemPromise,
}: {
  searchQuery?: string;
  initialProblemPromise: Promise<ProblemData>;
}) {
  const initialProblem = await initialProblemPromise;

  if (!initialProblem) {
    return (
      <p className="mt-10 text-sm text-rose-500 text-center">
        {searchQuery
          ? '検索条件に一致する問題が見つかりませんでした。'
          : '問題が見つかりませんでした。'}
      </p>
    );
  }

  return <FillBlankFlow initialProblem={initialProblem} />;
}

export default async function FillBlankPage({ searchParams }: FillBlankPageProps) {
  const searchQuery = (await searchParams).search?.trim();
  const initialProblemPromise = loadInitialProblem({ searchQuery });

  return (
    <>
      <HeaderPortal>ana-ume</HeaderPortal>
      <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
        <FillBlankContent searchQuery={searchQuery} initialProblemPromise={initialProblemPromise} />
      </Suspense>
    </>
  );
}
