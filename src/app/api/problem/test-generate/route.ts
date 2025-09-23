import { NextResponse } from 'next/server';
import {
  generateProblem,
  generateAudioAssets,
  generateImagePrompt,
  type GenerateRequest,
} from '@/lib/problem-generator';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateImage(prompt: string) {
  const image = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1536',
  });

  const first = image.data?.[0];
  if (!first) {
    throw new Error('Failed to generate image');
  }

  if (first.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  if (first.url) {
    return first.url;
  }

  throw new Error('Failed to generate image');
}

export async function POST(req: Request) {
  try {
    const body: GenerateRequest = await req.json().catch(() => ({}));

    console.log('[test-generate] 問題生成開始');

    // 問題を生成
    const problem = await generateProblem();

    console.log('[test-generate] 問題生成完了、アセット生成開始');

    // アセットを並列生成
    const assetPromises: Promise<unknown>[] = [generateAudioAssets(problem)];

    // 画像プロンプト生成
    const imagePrompt = generateImagePrompt(problem);

    // 画像が必要な場合は生成
    if (!body.withoutPicture) {
      assetPromises.push(generateImage(imagePrompt));
    }

    const results = await Promise.all(assetPromises);

    const audioAssets = results[0];
    const compositeImage = !body.withoutPicture && results[1] ? results[1] : null;

    console.log('[test-generate] アセット生成完了');

    return NextResponse.json({
      problem: {
        english: problem.englishSentence,
        japaneseReply: problem.japaneseReply,
        scenePrompt: imagePrompt,
        type: body.type || 'short',
        sceneId: problem.place,
        nuance: 'カジュアル', // 仮の値
        genre: '会話', // 仮の値
        interactionIntent: '日常会話', // 仮の値
        options: [problem.japaneseSentence, ...problem.incorrectOptions],
        correctIndex: 0,
        characterRoles: {
          character1: problem.senderRole,
          character2: problem.receiverRole,
        },
      },
      assets: {
        imagePrompt,
        composite: compositeImage,
        audio: audioAssets,
      },
    });
  } catch (error) {
    console.error('[test-generate] error', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
