import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import PromptTestClient from './prompt-test-client';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

function PromptTestSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="h-10 bg-[var(--border)] animate-pulse rounded mb-4" />
        <div className="bg-[var(--background)] rounded-lg shadow-md p-6 space-y-4">
          <div className="h-6 bg-[var(--border)] animate-pulse rounded" />
          <div className="h-40 bg-[var(--border)] animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}

export default async function PromptTestPage() {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;

  if (!email || !(await isAdminEmail(email))) {
    notFound();
  }

  return (
    <Suspense fallback={<PromptTestSkeleton />}>
      <PromptTestClient />
    </Suspense>
  );
}
