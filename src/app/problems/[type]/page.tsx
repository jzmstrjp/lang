import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';

const validTypes = ['kids', 'short', 'medium', 'long'] as const;

type ProblemPageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ search?: string; latest?: string }>;
};

type ProblemData = ProblemWithAudio | null;

function loadInitialProblem({
  type,
  searchQuery,
  latestCount,
}: {
  type: ProblemLength;
  searchQuery?: string;
  latestCount?: number;
}): Promise<ProblemData> {
  return (async () => {
    const { problems } = await fetchProblems({
      type,
      difficultyLevel: 'non_kids',
      search: searchQuery,
      limit: 1,
      includeNullDifficulty: true,
      latestCount,
    });
    return problems[0] ?? null;
  })();
}

const fetchIsAdmin = async () => {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;
  if (!email) {
    return false;
  }
  return isAdminEmail(email);
};

async function ProblemContent({
  type,
  searchQuery,
  latestCount,
  initialProblemPromise,
  isAdminPromise,
}: {
  type: ProblemLength;
  searchQuery?: string;
  latestCount?: number;
  initialProblemPromise: Promise<ProblemData>;
  isAdminPromise: Promise<boolean>;
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

  return (
    <ProblemFlow
      length={type}
      difficultyLevel="non_kids"
      initialProblem={initialProblem}
      isAdminPromise={isAdminPromise}
      includeNullDifficulty={true}
      latestCount={latestCount}
    />
  );
}

export default async function ProblemPage({ params, searchParams }: ProblemPageProps) {
  const { type } = await params;

  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.search?.trim();
  const latestParam = resolvedSearchParams.latest;
  const parsedLatest = latestParam !== undefined ? parseInt(latestParam, 10) : NaN;
  const latestCount = Number.isFinite(parsedLatest) && parsedLatest > 0 ? parsedLatest : undefined;
  const displayName = type;
  const initialProblemPromise = loadInitialProblem({
    type: type as ProblemLength,
    searchQuery,
    latestCount,
  });
  const isAdminPromise = fetchIsAdmin();

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
        <ProblemContent
          type={type as ProblemLength}
          searchQuery={searchQuery}
          latestCount={latestCount}
          initialProblemPromise={initialProblemPromise}
          isAdminPromise={isAdminPromise}
        />
      </Suspense>
    </>
  );
}
