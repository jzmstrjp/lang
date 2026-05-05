import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { DifficultyLevel } from '@/components/problem/problem-flow';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems, loadInitialProblems } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';
import { DIFFICULTY_LEVEL_RULES, VALID_DIFFICULTY_LEVELS } from '@/config/problem';

type LevelPageProps = {
  params: Promise<{ level: string }>;
  searchParams: Promise<{ search?: string }>;
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
  const searchQuery = (await searchParams).search?.trim();

  const isAdminPromise = fetchIsAdmin();
  // 検索時はキャッシュを通さず最新を取りに行く。
  // ランダム抽出はクライアント側で行う（PPR の prerender 固定を避けるため）。
  const initialProblems = searchQuery
    ? (
        await fetchProblems({
          difficultyLevel,
          search: searchQuery,
          includeNullDifficulty: false,
          limit: 1,
        })
      ).problems
    : await loadInitialProblems({
        difficultyLevel,
        includeNullDifficulty: false,
      });

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      {initialProblems.length > 0 ? (
        <ProblemFlow
          difficultyLevel={difficultyLevel}
          initialProblems={initialProblems}
          isAdminPromise={isAdminPromise}
          includeNullDifficulty={false}
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
