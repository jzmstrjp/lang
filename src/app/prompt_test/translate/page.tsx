import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { prisma } from '@/lib/prisma';
import TranslateTestClient from './translate-test-client';
import type { DefaultScene } from './translate-test-client';

async function TranslateTestPageContent() {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;

  if (!email || !(await isAdminEmail(email))) {
    notFound();
  }

  const count = await prisma.problem.count();
  const randomProblem =
    count > 0
      ? await prisma.problem.findFirst({
          skip: Math.floor(Math.random() * count),
          select: {
            senderName: true,
            receiverName: true,
            senderRole: true,
            receiverRole: true,
            senderVoice: true,
            receiverVoice: true,
            englishSentence: true,
            japaneseSentence: true,
            englishReply: true,
            japaneseReply: true,
            place: true,
            receiverPlace: true,
            how: true,
            senderWhen: true,
            senderWhy: true,
            senderWant: true,
          },
        })
      : null;

  const defaultScene: DefaultScene | undefined = randomProblem
    ? {
        senderName: randomProblem.senderName,
        receiverName: randomProblem.receiverName,
        senderRole: randomProblem.senderRole,
        receiverRole: randomProblem.receiverRole,
        senderVoice: randomProblem.senderVoice === 'male' ? 'male' : 'female',
        receiverVoice: randomProblem.receiverVoice === 'male' ? 'male' : 'female',
        englishSentence: randomProblem.englishSentence,
        japaneseSentence: randomProblem.japaneseSentence,
        englishReply: randomProblem.englishReply,
        japaneseReply: randomProblem.japaneseReply,
        place: randomProblem.place,
        receiverPlace: randomProblem.receiverPlace,
        how: randomProblem.how,
        senderWhen: randomProblem.senderWhen,
        senderWhy: randomProblem.senderWhy,
        senderWant: randomProblem.senderWant,
      }
    : undefined;

  return <TranslateTestClient defaultScene={defaultScene} />;
}

export default function TranslateTestPage() {
  return (
    <Suspense fallback={null}>
      <TranslateTestPageContent />
    </Suspense>
  );
}
