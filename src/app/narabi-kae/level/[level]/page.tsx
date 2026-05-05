import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import WordSortFlow from '@/components/word-sort/word-sort-flow';
import { fetchProblems, loadInitialProblems } from '@/lib/problem-service';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { DIFFICULTY_LEVEL_RULES } from '@/config/problem';
import type { DifficultyLevel } from '@/config/problem';

const ALLOWED_LEVELS: DifficultyLevel[] = ['kids', 'non_kids'];

type LevelPageProps = {
  params: Promise<{ level: string }>;
  searchParams: Promise<{ search?: string }>;
};

async function WordSortLevelContent({ params, searchParams }: LevelPageProps) {
  const { level } = await params;

  if (!ALLOWED_LEVELS.includes(level as DifficultyLevel)) {
    notFound();
  }

  const difficultyLevel = level as DifficultyLevel;
  const displayName = DIFFICULTY_LEVEL_RULES[difficultyLevel].displayName;
  const searchQuery = (await searchParams).search?.trim();

  // ランダム抽出はクライアント側で行う（PPR の prerender 固定を避けるため）。
  const initialProblems = searchQuery
    ? (
        await fetchProblems({
          difficultyLevel,
          search: searchQuery,
          maxWordCount: 13,
          includeNullDifficulty: false,
          limit: 1,
        })
      ).problems
    : await loadInitialProblems({
        difficultyLevel,
        maxWordCount: 13,
        includeNullDifficulty: false,
      });

  return (
    <>
      <HeaderPortal>narabi-kae / {displayName}</HeaderPortal>
      {initialProblems.length > 0 ? (
        <WordSortFlow initialProblems={initialProblems} difficultyLevel={difficultyLevel} />
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

export default function WordSortLevelPage({ params, searchParams }: LevelPageProps) {
  return (
    <Suspense fallback={<LoadingSpinner label="問題を取得中..." className="mt-20" />}>
      <WordSortLevelContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
