import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import PhraseTestClient from './phrase-test-client';

async function PhraseTestPageContent() {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;

  if (!email || !(await isAdminEmail(email))) {
    notFound();
  }

  return <PhraseTestClient />;
}

export default function PhraseTestPage() {
  return (
    <Suspense fallback={null}>
      <PhraseTestPageContent />
    </Suspense>
  );
}
