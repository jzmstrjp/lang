import { Suspense, use } from 'react';
import { notFound } from 'next/navigation';
import { HeaderPortal } from '@/components/layout/header-portal';
import ProblemFlow, { ProblemLength } from '@/components/problem/problem-flow';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { fetchProblems } from '@/lib/problem-service';
import { ProblemLoadingPlaceholder } from '@/components/ui/problem-loading-placeholder';

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

type ProblemData = {
  initialProblem: ProblemWithAudio | null;
  isAdmin: boolean;
};

function loadProblemData({
  type,
  searchQuery,
}: {
  type: ProblemLength;
  searchQuery?: string;
}): Promise<ProblemData> {
  return (async () => {
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

    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;
    const isAdmin = email ? await isAdminEmail(email) : false;

    return { initialProblem, isAdmin };
  })();
}

function ProblemContent({
  type,
  searchQuery,
  dataPromise,
}: {
  type: ProblemLength;
  searchQuery?: string;
  dataPromise: Promise<ProblemData>;
}) {
  const { initialProblem, isAdmin } = use(dataPromise);

  if (!initialProblem) {
    return (
      <p className="mt-10 text-sm text-rose-500 text-center">
        {searchQuery
          ? '検索条件に一致する問題が見つかりませんでした。'
          : '問題が見つかりませんでした。'}
      </p>
    );
  }

  return <ProblemFlow length={type} initialProblem={initialProblem} isAdmin={isAdmin} />;
}

export default async function ProblemPage({ params, searchParams }: ProblemPageProps) {
  const { type } = await params;

  if (!validTypes.includes(type as ProblemLength)) {
    notFound();
  }

  const searchQuery = (await searchParams).search?.trim();
  const displayName = type;
  const problemDataPromise = loadProblemData({ type: type as ProblemLength, searchQuery });

  return (
    <>
      <HeaderPortal>{displayName}</HeaderPortal>
      <Suspense fallback={<ProblemLoadingPlaceholder message="問題を取得中..." />}>
        <ProblemContent
          type={type as ProblemLength}
          searchQuery={searchQuery}
          dataPromise={problemDataPromise}
        />
      </Suspense>
    </>
  );
}
