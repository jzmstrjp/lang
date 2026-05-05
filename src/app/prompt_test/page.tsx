import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import PromptTestClient from './prompt-test-client';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

async function PromptTestPageContent() {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;

  if (!email || !(await isAdminEmail(email))) {
    notFound();
  }

  return <PromptTestClient />;
}

export default function PromptTestPage() {
  return (
    <Suspense fallback={null}>
      <PromptTestPageContent />
    </Suspense>
  );
}
