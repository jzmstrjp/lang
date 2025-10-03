import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import { fetchProblems } from '@/lib/problem-service';
import { InlineLoadingSpinner } from '@/components/ui/loading-spinner';
import { StartButton } from '@/components/ui/start-button';

const validTypes = ['short', 'medium', 'long'] as const;

type ProblemPageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ search?: string }>;
};

// データ取得部分を別コンポーネントに分離
async function ProblemContent({
  type,
  searchQuery,
}: {
  type: ProblemLength;
  searchQuery?: string;
}) {
  const { problems } = await fetchProblems({
    type,
    search: searchQuery,
    limit: 1,
  });

  const initialProblem = problems[0];

  if (!initialProblem) {
    return (
      <p className="mt-10 text-sm text-rose-500 text-center">
        {searchQuery
          ? '検索条件に一致する問題が見つかりませんでした。'
          : '問題が見つかりませんでした。'}
      </p>
    );
  }

  return <ProblemFlow length={type} initialProblem={initialProblem} />;
}

// Loading コンポーネント
function LoadingFallback() {
  return (
    <div className="relative max-w-[500px] mx-auto">
      {/* 画像と同じアスペクト比（500x750 = 2:3）のプレースホルダー */}
      <div className="w-full aspect-[2/3] bg-[#f4f1ea]/30 rounded-lg" />

      <div className="absolute inset-0 flex items-center justify-center">
        <StartButton error={null} disabled>
          <InlineLoadingSpinner />
          <span className="ml-2">問題を取得中...</span>
        </StartButton>
      </div>
    </div>
  );
}

export default async function ProblemPage({ params, searchParams }: ProblemPageProps) {
  const { type } = await params;

  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  const awaitedSearchParams = await searchParams;
  const searchQuery = awaitedSearchParams.search?.trim();
  const displayName = type;

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <Suspense fallback={<LoadingFallback />}>
        <ProblemContent type={type as ProblemLength} searchQuery={searchQuery} />
      </Suspense>
    </>
  );
}
