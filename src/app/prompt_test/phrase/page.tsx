import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { prisma } from '@/lib/prisma';
import PhraseTestClient from './phrase-test-client';

async function PhraseTestPageContent() {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;

  if (!email || !(await isAdminEmail(email))) {
    notFound();
  }

  const count = await prisma.word.count();
  const randomWord =
    count > 0
      ? await prisma.word.findFirst({
          skip: Math.floor(Math.random() * count),
          select: { expression: true },
        })
      : null;

  return <PhraseTestClient defaultPhrase={randomWord?.expression ?? ''} />;
}

export default function PhraseTestPage() {
  return (
    <Suspense fallback={null}>
      <PhraseTestPageContent />
    </Suspense>
  );
}
