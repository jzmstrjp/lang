import { Suspense, use } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';
import shortProblems from '@/app/staticProbremData/short';
import mediumProblems from '@/app/staticProbremData/medium';
import longProblems from '@/app/staticProbremData/long';

const validTypes = ['short', 'medium', 'long'] as const;

type ProblemPageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ search?: string }>;
};

type ProblemWithStaticFlag = ProblemWithAudio & { isStatic?: boolean };

type ProblemData = ProblemWithStaticFlag | null;

const STATIC_PROBLEM_DATA: Record<ProblemLength, ProblemWithAudio[]> = {
  short: shortProblems,
  medium: mediumProblems,
  long: longProblems,
};

function getRandomStaticProblem(type: ProblemLength): ProblemWithStaticFlag | null {
  const problems = STATIC_PROBLEM_DATA[type];
  if (!problems?.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * problems.length);
  const problem = problems[randomIndex];
  return problem ? { ...problem, isStatic: true } : null;
}

function loadInitialProblem({
  type,
  searchQuery,
}: {
  type: ProblemLength;
  searchQuery?: string;
}): Promise<ProblemData> {
  return (async () => {
    let initialProblem: ProblemWithStaticFlag | null = null;

    if (!searchQuery) {
      initialProblem = getRandomStaticProblem(type);
    }

    if (!initialProblem) {
      const { problems } = await fetchProblems({
        type,
        search: searchQuery,
        limit: 1,
      });
      const firstProblem = problems[0];
      initialProblem = firstProblem ? { ...firstProblem } : null;
    }

    return initialProblem;
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

function ProblemContent({
  type,
  searchQuery,
  initialProblemPromise,
  isAdminPromise,
}: {
  type: ProblemLength;
  searchQuery?: string;
  initialProblemPromise: Promise<ProblemData>;
  isAdminPromise: Promise<boolean>;
}) {
  const initialProblem = use(initialProblemPromise);

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
    />
  );
}

export default async function ProblemPage({ params, searchParams }: ProblemPageProps) {
  const { type } = await params;

  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  const searchQuery = (await searchParams).search?.trim();
  const displayName = type;
  const initialProblemPromise = loadInitialProblem({ type: type as ProblemLength, searchQuery });
  const isAdminPromise = fetchIsAdmin();

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
        <ProblemContent
          type={type as ProblemLength}
          searchQuery={searchQuery}
          initialProblemPromise={initialProblemPromise}
          isAdminPromise={isAdminPromise}
        />
      </Suspense>
    </>
  );
}
