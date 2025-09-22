import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

// 環境変数を読み込み
if (typeof window === 'undefined') {
  config({ path: '.env' });
  config({ path: '.env.local' });
}

// R2接続設定
const CLOUDFLARE_ACCOUNT_ID = 'd6440650d9139a91a55c362227fb9310';
const R2_ENDPOINT = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'prod-lang-media';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

console.log('[R2] Debug info:', {
  bucket: R2_BUCKET_NAME,
  accessKeyLength: R2_ACCESS_KEY_ID?.length,
  secretKeyLength: R2_SECRET_ACCESS_KEY?.length,
  endpoint: R2_ENDPOINT,
});

function ensureR2Config() {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set in environment variables',
    );
  }
}

// R2クライアント作成
function createR2Client() {
  ensureR2Config();

  return new S3Client({
    region: 'auto', // R2は自動リージョン
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // R2に必要な設定
  });
}

/**
 * バッファデータをR2にアップロード
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<string> {
  const client = createR2Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
    // パブリックアクセス設定
    ACL: 'public-read',
  });

  await client.send(command);

  // パブリックURLを返す
  return `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
}

/**
 * 音声ファイルをR2にアップロード
 */
export async function uploadAudioToR2(
  audioBuffer: Buffer,
  problemId: string,
  language: 'en' | 'ja',
  speaker: 'male' | 'female' | 'neutral',
): Promise<string> {
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `audio/${timestamp}/${problemId}_${language}_${speaker}.mp3`;

  return uploadToR2(key, audioBuffer, 'audio/mpeg', {
    problemId,
    language,
    speaker,
    type: 'audio',
  });
}

/**
 * 画像ファイルをR2にアップロード
 */
export async function uploadImageToR2(
  imageBuffer: Buffer,
  problemId: string,
  imageType: 'composite',
): Promise<string> {
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `images/${timestamp}/${problemId}_${imageType}.png`;

  return uploadToR2(key, imageBuffer, 'image/png', {
    problemId,
    imageType,
    type: 'image',
  });
}

/**
 * R2からファイルを取得（必要に応じて）
 */
export async function getFromR2(key: string): Promise<Buffer> {
  const client = createR2Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`File not found: ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * ファイルキーからパブリックURLを生成
 */
export function getR2PublicUrl(key: string): string {
  return `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
}
