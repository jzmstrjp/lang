import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { InlineLoadingSpinner } from '@/components/ui/loading-spinner';
import { StartButton } from '@/components/ui/start-button';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems } from '@/lib/problem-service';

const validTypes = ['short', 'medium', 'long'] as const;

type ProblemPageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ search?: string }>;
};

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// データ取得部分を別コンポーネントに分離
async function ProblemContent({
  type,
  searchQuery,
}: {
  type: ProblemLength;
  searchQuery?: string;
}) {
  const baseUrl = getBaseUrl();
  let initialProblem: ProblemWithAudio | null = null;

  if (!searchQuery) {
    try {
      const cacheResponse = await fetch(`${baseUrl}/api/problem-cache/${type}`, {
        cache: 'no-store',
      });

      if (cacheResponse.ok && cacheResponse.status === 200) {
        const data = (await cacheResponse.json()) as { problem?: ProblemWithAudio | null };
        initialProblem = data.problem ?? null;
      }
    } catch (error) {
      console.warn('[ProblemPage] Failed to fetch cached problem:', error);
    }
  }

  if (!initialProblem) {
    const { problems } = await fetchProblems({
      type,
      search: searchQuery,
      limit: 1,
    });
    initialProblem = problems[0] ?? null;
  }

  if (!initialProblem) {
    return (
      <p className="mt-10 text-sm text-rose-500 text-center">
        {searchQuery
          ? '検索条件に一致する問題が見つかりませんでした。'
          : '問題が見つかりませんでした。'}
      </p>
    );
  }

  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;
  const isAdmin = email ? await isAdminEmail(email) : false;

  return <ProblemFlow length={type} initialProblem={initialProblem} isAdmin={isAdmin} />;
}

// Loading コンポーネント
function LoadingFallback() {
  return (
    <div className="relative max-w-[500px] mx-auto">
      {/* 画像と同じアスペクト比（500x750 = 2:3）のプレースホルダー */}
      <div className="w-full aspect-[2/3] rounded-lg" />

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
