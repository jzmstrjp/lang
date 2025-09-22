import OpenAI from 'openai';
import { config } from 'dotenv';
import { uploadImageToR2 } from './r2-client';

// 環境変数を読み込み
if (typeof window === 'undefined') {
  config({ path: '.env' });
  config({ path: '.env.local' });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
}

/**
 * 既存の画像生成関数（Base64を返す）
 */
export async function generateImage(prompt: string): Promise<string> {
  ensureApiKey();

  const image = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1536',
  });

  const first = image.data?.[0];
  if (!first) {
    console.error('[image-utils] image generation returned no data', image);
    throw new Error('Failed to generate image');
  }

  if (first.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  if (first.url) {
    return first.url;
  }

  console.error('[image-utils] image generation missing url/b64_json', first);
  throw new Error('Failed to generate image');
}

/**
 * 画像を生成してBufferを返す（アップロードは別途実行）
 */
export async function generateImageBuffer(prompt: string): Promise<Buffer> {
  ensureApiKey();

  const image = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1536',
  });

  const first = image.data?.[0];
  if (!first) {
    console.error('[image-utils] image generation failed', image);
    throw new Error('Failed to generate image');
  }

  if (first.b64_json) {
    // Base64形式の場合
    return Buffer.from(first.b64_json, 'base64');
  } else if (first.url) {
    // URL形式の場合、ダウンロードしてBufferに変換
    const response = await fetch(first.url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else {
    console.error('[image-utils] image generation missing url/b64_json', first);
    throw new Error('Failed to generate image');
  }
}

/**
 * 画像を生成してR2にアップロード（レガシー関数、後で削除予定）
 */
export async function generateImageAndUploadToR2(
  prompt: string,
  problemId: string,
): Promise<string> {
  const imageBuffer = await generateImageBuffer(prompt);
  return uploadImageToR2(imageBuffer, problemId, 'composite');
}

/**
 * Base64画像データをR2にアップロード
 */
export async function uploadBase64ImageToR2(
  base64Data: string,
  problemId: string,
): Promise<string> {
  // data:image/png;base64,... の形式から base64 部分を抽出
  const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const imageBuffer = Buffer.from(base64, 'base64');

  return uploadImageToR2(imageBuffer, problemId, 'composite');
}
