import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import FillBlankFlow from '@/components/fill-blank/fill-blank-flow';
import { fetchProblems, loadInitialProblems, pickRandomProblem } from '@/lib/problem-service';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { DIFFICULTY_LEVEL_RULES } from '@/config/problem';
import type { DifficultyLevel } from '@/config/problem';
import { generateBlankProblem } from '@/lib/fill-blank-utils';

const ALLOWED_LEVELS: DifficultyLevel[] = ['kids', 'non_kids'];

type LevelPageProps = {
  params: Promise<{ level: string }>;
  searchParams: Promise<{ search?: string }>;
};

async function FillBlankLevelContent({ params, searchParams }: LevelPageProps) {
  const { level } = await params;

  if (!ALLOWED_LEVELS.includes(level as DifficultyLevel)) {
    notFound();
  }

  const difficultyLevel = level as DifficultyLevel;
  const displayName = DIFFICULTY_LEVEL_RULES[difficultyLevel].displayName;
  const searchQuery = (await searchParams).search?.trim();

  // 検索時はキャッシュを通さず最新を取りに行く。
  // それ以外は loadInitialProblems の結果（プール）から Server 側でランダムに 1 件選ぶ。
  // この content 自体は dynamic なのでリクエストごとに評価される。
  const includeNullDifficulty = difficultyLevel !== 'kids';

  const initialProblems = searchQuery
    ? (
        await fetchProblems({
          difficultyLevel,
          search: searchQuery,
          includeNullDifficulty,
          limit: 1,
        })
      ).problems
    : await loadInitialProblems({
        difficultyLevel,
        includeNullDifficulty,
      });

  const initialProblem = pickRandomProblem(initialProblems);
  // hydration mismatch を避けるため、ランダム性を含む blankProblem の生成は server 側で行う。
  const initialBlankProblem = initialProblem ? generateBlankProblem(initialProblem) : null;

  return (
    <>
      <HeaderPortal>ana-ume / {displayName}</HeaderPortal>
      {initialProblem && initialBlankProblem ? (
        <FillBlankFlow
          initialProblem={initialProblem}
          initialBlankProblem={initialBlankProblem}
          difficultyLevel={difficultyLevel}
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

export default function FillBlankLevelPage({ params, searchParams }: LevelPageProps) {
  return (
    <Suspense fallback={<LoadingSpinner label="問題を取得中..." className="mt-20" />}>
      <FillBlankLevelContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
