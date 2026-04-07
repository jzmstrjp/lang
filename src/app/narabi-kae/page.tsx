import { Suspense } from 'react';
import { HeaderPortal } from '@/components/layout/header-portal';
import WordSortFlow from '@/components/word-sort/word-sort-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { fetchProblems } from '@/lib/problem-service';
import LoadingSpinner from '@/components/ui/loading-spinner';

type ProblemData = ProblemWithAudio | null;

type WordSortPageProps = {
  searchParams: Promise<{ search?: string }>;
};

function loadInitialProblem({ searchQuery }: { searchQuery?: string }): Promise<ProblemData> {
  return (async () => {
    const { problems } = await fetchProblems({
      limit: 1,
      maxWordCount: 13,
      search: searchQuery,
    });
    return problems[0] ?? null;
  })();
}

async function WordSortContent({
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

  return <WordSortFlow initialProblem={initialProblem} />;
}

export default async function WordSortPage({ searchParams }: WordSortPageProps) {
  const searchQuery = (await searchParams).search?.trim();
  const initialProblemPromise = loadInitialProblem({ searchQuery });

  return (
    <>
      <HeaderPortal>narabi-kae</HeaderPortal>
      <Suspense fallback={<LoadingSpinner label="問題を取得中..." className="mt-20" />}>
        <WordSortContent searchQuery={searchQuery} initialProblemPromise={initialProblemPromise} />
      </Suspense>
    </>
  );
}
