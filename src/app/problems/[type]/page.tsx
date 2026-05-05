import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems, loadInitialProblemsByLength } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';

const validTypes = ['kids', 'short', 'medium', 'long'] as const;

type ProblemPageProps = {
  params: Promise<{ type: string }>;
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

async function ProblemPageContent({ params, searchParams }: ProblemPageProps) {
  const { type } = await params;

  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.search?.trim();
  const latestParam = resolvedSearchParams.latest;
  const parsedLatest = latestParam !== undefined ? parseInt(latestParam, 10) : NaN;
  const latestCount = Number.isFinite(parsedLatest) && parsedLatest > 0 ? parsedLatest : undefined;
  const problemLength = type as ProblemLength;

  const isAdminPromise = fetchIsAdmin();
  // search / latest 指定時は最新の DB 結果が欲しいのでキャッシュを通さない。
  // それ以外は全 type 集約済みのキャッシュからプールを取り出す。
  // 配列のまま ProblemFlow に渡し、ランダム抽出はクライアント側で行う
  // （サーバーで Math.random すると PPR の prerender に固定されてしまうため）。
  const initialProblems =
    searchQuery || latestCount !== undefined
      ? (
          await fetchProblems({
            type: problemLength,
            difficultyLevel: 'non_kids',
            search: searchQuery,
            includeNullDifficulty: true,
            latestCount,
            limit: 1,
          })
        ).problems
      : (await loadInitialProblemsByLength())[problemLength];

  return (
    <>
      <HeaderPortal>{problemLength}</HeaderPortal>
      {initialProblems.length > 0 ? (
        <ProblemFlow
          length={problemLength}
          difficultyLevel="non_kids"
          initialProblems={initialProblems}
          isAdminPromise={isAdminPromise}
          includeNullDifficulty={true}
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

export default function ProblemPage({ params, searchParams }: ProblemPageProps) {
  return (
    <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
      <ProblemPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
