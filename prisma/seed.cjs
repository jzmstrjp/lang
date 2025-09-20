/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, ProblemType } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Minimal seed to verify migrations are applied.
  const sample = {
    type: ProblemType.short,
    english: 'Could you pass me the salt?',
    japanese: '塩を取っていただけますか？',
    options: [
      '塩を取っていただけますか？',
      'カレーが食べたい',
      '映画を見に行こう',
      '塩を取ってくれない？',
    ],
    correctIndex: 0,
    audioEnUrl: 'https://{r2-domain}/audio/en/sample.mp3',
    audioJaUrl: 'https://{r2-domain}/audio/ja/sample.mp3',
    sceneImageUrl: 'https://{r2-domain}/images/sample.jpg',
    sceneId: 'dining-salt-request',
    nuance: 'polite',
    genre: 'dining',
    patternGroup: 'request_salt_v1',
    isCached: true,
    qualityCheck: true,
  };

  await prisma.problem.upsert({
    where: { id: 'seed-problem-short' },
    update: sample,
    create: {
      id: 'seed-problem-short',
      ...sample,
    },
  });

  console.log('Seeded 1 example problem.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
