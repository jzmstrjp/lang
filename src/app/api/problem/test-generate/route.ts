import { NextResponse } from 'next/server';
import {
  generateProblem,
  generateAudioAssets,
  generateImagePrompt,
  generateImagePromptWithCharacters,
  generateImagePromptWithAnimals,
  type GenerateRequest,
} from '@/lib/problem-generator';
import OpenAI from 'openai';
import { IMAGE_MODEL_SETTING } from '@/const';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateImage(prompt: string) {
  const image = await openai.images.generate({
    ...IMAGE_MODEL_SETTING,
    prompt,
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

async function generateImageWithCharacters(prompt: string) {
  // キャラクター画像を読み込み
  const takashiPath = path.join(process.cwd(), 'images', 'takashi.png');
  const akariPath = path.join(process.cwd(), 'images', 'akari.png');

  const takashiBuffer = await fs.readFile(takashiPath);
  const akariBuffer = await fs.readFile(akariPath);

  // BufferをUint8Arrayに変換してからFileオブジェクトに変換
  const imageFiles = [
    new File([new Uint8Array(takashiBuffer)], 'takashi.png', { type: 'image/png' }),
    new File([new Uint8Array(akariBuffer)], 'akari.png', { type: 'image/png' }),
  ];

  const image = await openai.images.edit({
    ...IMAGE_MODEL_SETTING,
    image: imageFiles,
    prompt: prompt,
    quality: 'medium',
  });

  const first = image.data?.[0];
  if (!first) {
    throw new Error('Failed to generate image with characters');
  }

  if (first.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  if (first.url) {
    return first.url;
  }

  throw new Error('Failed to generate image with characters');
}

async function generateImageWithAnimals(prompt: string) {
  // 動物画像を読み込み
  const catPath = path.join(process.cwd(), 'images', 'cat.png');
  const catBuffer = await fs.readFile(catPath);

  // BufferをUint8Arrayに変換してからFileオブジェクトに変換
  const imageFiles = [new File([new Uint8Array(catBuffer)], 'cat.png', { type: 'image/png' })];

  const image = await openai.images.edit({
    ...IMAGE_MODEL_SETTING,
    image: imageFiles,
    prompt: prompt,
    quality: 'medium',
  });

  const first = image.data?.[0];
  if (!first) {
    throw new Error('Failed to generate image with animals');
  }

  if (first.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  if (first.url) {
    return first.url;
  }

  throw new Error('Failed to generate image with animals');
}

export async function POST(req: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body: GenerateRequest & { useCharacterImages?: boolean; useAnimalImages?: boolean } =
      await req.json().catch(() => ({}));

    console.log('[test-generate] 問題生成開始');

    // 問題を生成（問題タイプを渡す）
    // body.typeがundefinedの場合はそのまま渡す（全問題から選択）
    const problem = await generateProblem(body.type);

    console.log('[test-generate] 問題生成完了、アセット生成開始');

    // アセットを並列生成
    const assetPromises: Promise<unknown>[] = [generateAudioAssets(problem)];

    // 画像プロンプト生成（使用するモードに応じて専用プロンプト）
    let imagePrompt: string;
    if (body.useAnimalImages) {
      imagePrompt = generateImagePromptWithAnimals(problem);
    } else if (body.useCharacterImages) {
      imagePrompt = generateImagePromptWithCharacters(problem);
    } else {
      imagePrompt = generateImagePrompt(problem);
    }

    // 画像が必要な場合は生成
    if (!body.withoutPicture) {
      if (body.useAnimalImages) {
        assetPromises.push(generateImageWithAnimals(imagePrompt));
      } else if (body.useCharacterImages) {
        assetPromises.push(generateImageWithCharacters(imagePrompt));
      } else {
        assetPromises.push(generateImage(imagePrompt));
      }
    }

    const results = await Promise.all(assetPromises);

    const audioAssets = results[0];
    const compositeImage = !body.withoutPicture && results[1] ? results[1] : null;

    console.log('[test-generate] アセット生成完了');

    return NextResponse.json({
      problem,
      options: [problem.japaneseSentence, ...problem.incorrectOptions],
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
