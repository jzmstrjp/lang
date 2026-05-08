import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { DifficultyLevel } from '@/components/problem/problem-flow';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems, loadInitialProblems, pickRandomProblem } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';
import { DIFFICULTY_LEVEL_RULES, VALID_DIFFICULTY_LEVELS } from '@/config/problem';

type LevelPageProps = {
  params: Promise<{ level: string }>;
  searchParams: Promise<{ search?: string; latest?: string }>;
};

const fetchIsAdmin = async () => {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;
  if (!email) {
    return false;
  }
  return isAdminEmail(email);
};

async function LevelPageContent({ params, searchParams }: LevelPageProps) {
  const { level } = await params;

  if (!VALID_DIFFICULTY_LEVELS.includes(level as DifficultyLevel)) {
    notFound();
  }

  const difficultyLevel = level as DifficultyLevel;
  const displayName = DIFFICULTY_LEVEL_RULES[difficultyLevel].displayName;
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.search?.trim();
  const latestParam = resolvedSearchParams.latest;
  const parsedLatest = latestParam !== undefined ? parseInt(latestParam, 10) : NaN;
  const latestCount = Number.isFinite(parsedLatest) && parsedLatest > 0 ? parsedLatest : undefined;

  const isAdminPromise = fetchIsAdmin();
  // search / latest 指定時はキャッシュを通さず最新を取りに行く。
  // それ以外は loadInitialProblems の結果（プール）から Server 側でランダムに 1 件選ぶ。
  // この LevelPageContent 自体は dynamic なのでリクエストごとに評価され、
  // プールがキャッシュされていてもユーザーごとに異なる問題が選ばれる。
  const initialProblems =
    searchQuery || latestCount !== undefined
      ? (
          await fetchProblems({
            difficultyLevel,
            search: searchQuery,
            includeNullDifficulty: false,
            latestCount,
            limit: 1,
          })
        ).problems
      : await loadInitialProblems({
          difficultyLevel,
          includeNullDifficulty: false,
        });

  const initialProblem = pickRandomProblem(initialProblems);

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      {initialProblem ? (
        <ProblemFlow
          difficultyLevel={difficultyLevel}
          initialProblem={initialProblem}
          isAdminPromise={isAdminPromise}
          includeNullDifficulty={false}
          latestCount={latestCount}
        />
      ) : (
        <p className="mt-10 text-sm text-rose-500 text-center">
          {searchQuery
            ? '検索条件に一致する問題が見つかりませんでした。'
            : '問題が見つかりませんでした。'}
        </p>
      )}
    </>
  );
}

export default function LevelPage({ params, searchParams }: LevelPageProps) {
  return (
    <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
      <LevelPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
