import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import WordSortFlow from '@/components/word-sort/word-sort-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { fetchProblems } from '@/lib/problem-service';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { DIFFICULTY_LEVEL_RULES } from '@/config/problem';
import type { DifficultyLevel } from '@/config/problem';

const ALLOWED_LEVELS: DifficultyLevel[] = ['kids', 'non_kids'];

type LevelPageProps = {
  params: Promise<{ level: string }>;
  searchParams: Promise<{ search?: string }>;
};

type ProblemData = ProblemWithAudio | null;

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
      maxWordCount: 13,
      includeNullDifficulty: false,
    });
    return problems[0] ?? null;
  })();
}

async function WordSortContent({
  difficultyLevel,
  searchQuery,
  initialProblemPromise,
}: {
  difficultyLevel: DifficultyLevel;
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

  return <WordSortFlow initialProblem={initialProblem} difficultyLevel={difficultyLevel} />;
}

export default async function WordSortLevelPage({ params, searchParams }: LevelPageProps) {
  const { level } = await params;

  if (!ALLOWED_LEVELS.includes(level as DifficultyLevel)) {
    notFound();
  }

  const difficultyLevel = level as DifficultyLevel;
  const displayName = DIFFICULTY_LEVEL_RULES[difficultyLevel].displayName;
  const searchQuery = (await searchParams).search?.trim();
  const initialProblemPromise = loadInitialProblem({ difficultyLevel, searchQuery });

  return (
    <>
      <HeaderPortal>narabi-kae / {displayName}</HeaderPortal>
      <Suspense fallback={<LoadingSpinner label="問題を取得中..." className="mt-20" />}>
        <WordSortContent
          difficultyLevel={difficultyLevel}
          searchQuery={searchQuery}
          initialProblemPromise={initialProblemPromise}
        />
      </Suspense>
    </>
  );
}
