/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, ProblemType, InteractionIntent } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Minimal seed to verify migrations are applied.
  const sample = {
    type: ProblemType.short,
    english: 'Could you pass me the salt?',
    japaneseReply: '了解、テーブルの右端にあるやつを渡すね。',
    options: [
      '塩を取ってくれる？',
      'カレーを温めてくれる？',
      '映画を見に行かない？',
      '水を注いでくれない？',
    ],
    correctIndex: 0,
    sceneId: 'dining-salt-request',
    scenePrompt:
      'Family dinner table with dishes and salt shaker in the center as someone reaches to help.',
    speakersSceneA: 'male',
    speakersSceneB: 'female',
    nuance: 'polite',
    genre: 'dining',
    patternGroup: 'request_salt_v1',
    wordCount: 5,
    interactionIntent: InteractionIntent.request,
    isCached: true,
    qualityCheck: true,
    sceneAImageUrl: 'https://{r2-domain}/images/sample-scene-a.jpg',
    sceneBImageUrl: 'https://{r2-domain}/images/sample-scene-b.jpg',
    audioEnUrl: 'https://{r2-domain}/audio/en/sample.mp3',
    audioJaUrl: 'https://{r2-domain}/audio/ja/sample.mp3',
  };

  const assetSample = {
    scenePrompt: sample.scenePrompt,
    sceneAImage: 'data:image/png;base64,placeholderA',
    sceneBImage: 'data:image/png;base64,placeholderB',
    audioEn: 'data:audio/mpeg;base64,placeholderEn',
    audioJa: 'data:audio/mpeg;base64,placeholderJa',
  };

  await prisma.problem.upsert({
    where: {
      english_interactionIntent_sceneId: {
        english: sample.english,
        interactionIntent: sample.interactionIntent,
        sceneId: sample.sceneId,
      },
    },
    update: {
      ...sample,
      asset: {
        upsert: {
          update: assetSample,
          create: assetSample,
        },
      },
    },
    create: {
      id: 'seed-problem-short',
      ...sample,
      asset: {
        create: assetSample,
      },
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
