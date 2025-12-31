import { Suspense, use } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { DifficultyLevel } from '@/components/problem/problem-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';
import { DIFFICULTY_LEVEL_RULES } from '@/config/problem';

const validLevels = ['kids', 'easy', 'normal', 'hard', 'expert'] as const;

type LevelPageProps = {
  params: Promise<{ level: string }>;
  searchParams: Promise<{ search?: string }>;
};

type ProblemWithStaticFlag = ProblemWithAudio & { isStatic?: boolean };

type ProblemData = ProblemWithStaticFlag | null;

function loadInitialProblem({
  difficultyLevel,
  searchQuery,
}: {
  difficultyLevel: DifficultyLevel;
  searchQuery?: string;
}): Promise<ProblemData> {
  return (async () => {
    const { problems } = await fetchProblems({
      difficultyLevel,
      search: searchQuery,
      limit: 1,
    });
    const firstProblem = problems[0];
    return firstProblem ? { ...firstProblem } : null;
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
  difficultyLevel,
  searchQuery,
  initialProblemPromise,
  isAdminPromise,
}: {
  difficultyLevel: DifficultyLevel;
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
      difficultyLevel={difficultyLevel}
      initialProblem={initialProblem}
      isAdminPromise={isAdminPromise}
    />
  );
}

export default async function LevelPage({ params, searchParams }: LevelPageProps) {
  const { level } = await params;

  if (!validLevels.includes(level as DifficultyLevel)) {
    notFound();
  }

  const searchQuery = (await searchParams).search?.trim();
  const difficultyLevel = level as DifficultyLevel;
  const displayName = DIFFICULTY_LEVEL_RULES[difficultyLevel].displayName;
  const initialProblemPromise = loadInitialProblem({ difficultyLevel, searchQuery });
  const isAdminPromise = fetchIsAdmin();

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
        <ProblemContent
          difficultyLevel={difficultyLevel}
          searchQuery={searchQuery}
          initialProblemPromise={initialProblemPromise}
          isAdminPromise={isAdminPromise}
        />
      </Suspense>
    </>
  );
}
