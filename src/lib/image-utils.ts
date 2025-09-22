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
 * 画像を生成してR2にアップロード（新しい関数）
 */
export async function generateImageAndUploadToR2(
  prompt: string,
  problemId: string,
): Promise<string> {
  ensureApiKey();

  const image = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1536',
    response_format: 'b64_json', // Base64形式で取得
  });

  const first = image.data?.[0];
  if (!first?.b64_json) {
    console.error('[image-utils] image generation failed or missing b64_json', image);
    throw new Error('Failed to generate image');
  }

  // Base64からBufferに変換
  const imageBuffer = Buffer.from(first.b64_json, 'base64');

  // R2にアップロードしてURLを返す
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
