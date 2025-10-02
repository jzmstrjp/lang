import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import { fetchProblems } from '@/lib/problem-service';

const validTypes = ['short', 'medium', 'long'] as const;

type ProblemPageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ search?: string }>;
};

export default async function ProblemPage({ params, searchParams }: ProblemPageProps) {
  const { type } = await params;

  // 無効なtypeの場合は404
  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  // サーバー側で初期問題を1問取得
  const awaitedSearchParams = await searchParams;
  const searchQuery = awaitedSearchParams.search?.trim();
  const { problems } = await fetchProblems({
    type: type as ProblemLength,
    search: searchQuery,
    limit: 1,
  });

  const initialProblem = problems[0];

  const displayName = type;

  // 初期問題が取得できない場合はエラー表示
  if (!initialProblem) {
    return (
      <>
        <HeaderPortal>{displayName}</HeaderPortal>
        <p className="mt-10 text-sm text-rose-500 text-center">
          {searchQuery
            ? '検索条件に一致する問題が見つかりませんでした。'
            : '問題が見つかりませんでした。'}
        </p>
      </>
    );
  }

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <ProblemFlow length={type as ProblemLength} initialProblem={initialProblem} />
    </>
  );
}
