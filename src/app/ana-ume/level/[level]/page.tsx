import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import FillBlankFlow from '@/components/fill-blank/fill-blank-flow';
import { loadInitialProblems, pickRandomProblem } from '@/lib/problem-service';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { DIFFICULTY_LEVEL_RULES } from '@/config/problem';
import type { DifficultyLevel } from '@/config/problem';

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

  const problems = await loadInitialProblems({
    difficultyLevel,
    search: searchQuery,
    includeNullDifficulty: false,
  });
  const initialProblem = pickRandomProblem(problems);

  return (
    <>
      <HeaderPortal>ana-ume / {displayName}</HeaderPortal>
      {initialProblem ? (
        <FillBlankFlow initialProblem={initialProblem} difficultyLevel={difficultyLevel} />
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
