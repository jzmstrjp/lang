import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import { gzip } from 'zlib';
import { promisify } from 'util';
import type { VoiceGender } from '../config/voice';
import { compressionConfig } from '../config/compression';

const gzipAsync = promisify(gzip);

export class R2AssetKey {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static forAudio(
    problemId: string,
    language: 'en' | 'ja' | 'en-reply',
    speaker: VoiceGender,
    now: Date = new Date(),
  ): R2AssetKey {
    const date = now.toISOString().slice(0, 10);
    const timeHash = now.getTime().toString(36);
    return new R2AssetKey(`audio/${date}/${problemId}_${language}_${speaker}_${timeHash}.mp3`);
  }

  static forImage(problemId: string, format: 'png' | 'webp', now: Date = new Date()): R2AssetKey {
    const date = now.toISOString().slice(0, 10);
    const timeHash = now.getTime().toString(36);
    return new R2AssetKey(`images/${date}/${problemId}_composite_${timeHash}.${format}`);
  }
}

// 環境変数を読み込み
if (typeof window === 'undefined') {
  config({ path: '.env' });
  config({ path: '.env.local' });
}

// R2接続設定
const CLOUDFLARE_ACCOUNT_ID = 'd6440650d9139a91a55c362227fb9310';
const R2_ENDPOINT = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'prod-lang-media-apac';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

function ensureR2Config() {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set in environment variables',
    );
  }

  console.log('[R2] Debug info:', {
    bucket: R2_BUCKET_NAME,
    accessKeyLength: R2_ACCESS_KEY_ID?.length,
    secretKeyLength: R2_SECRET_ACCESS_KEY?.length,
    endpoint: R2_ENDPOINT,
  });
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
    tls: true,
    maxAttempts: 3,
  });
}

/**
 * バッファデータをR2にアップロード
 */
async function uploadToR2(
  key: R2AssetKey,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
  compress?: boolean,
): Promise<string> {
  const client = createR2Client();

  let body = buffer;
  const finalContentType = contentType;
  let contentEncoding: string | undefined;

  // 圧縮設定の確認
  const shouldCompress =
    compress !== false &&
    compressionConfig.enabled &&
    buffer.length > compressionConfig.minSizeForCompression;

  if (shouldCompress) {
    try {
      const compressedBuffer = await gzipAsync(buffer);

      // 設定された最小圧縮率を満たす場合のみ圧縮版を使用
      const compressionRatio = 1 - compressedBuffer.length / buffer.length;
      if (compressionRatio >= compressionConfig.minCompressionRatio) {
        body = compressedBuffer;
        contentEncoding = 'gzip';

        console.log(
          `[R2] 圧縮効果: ${buffer.length} → ${compressedBuffer.length} bytes (${Math.round(compressionRatio * 100)}% 削減)`,
        );
      } else {
        console.log(
          `[R2] 圧縮効果が設定値(${Math.round(compressionConfig.minCompressionRatio * 100)}%)未満のため元のファイルを使用: ${buffer.length} bytes`,
        );
      }
    } catch (error) {
      console.warn(`[R2] 圧縮エラー、元のファイルを使用: ${error}`);
    }
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key.value,
    Body: body,
    ContentType: finalContentType,
    ContentEncoding: contentEncoding,
    Metadata: metadata,
    // パブリックアクセス設定
    ACL: 'public-read',
  });

  await client.send(command);

  return key.value;
}

/**
 * 音声ファイルをR2にアップロード
 */
export async function uploadAudioToR2(
  audioBuffer: Buffer,
  problemId: string,
  language: 'en' | 'ja' | 'en-reply',
  speaker: VoiceGender,
  compress: boolean = false,
): Promise<string> {
  const key = R2AssetKey.forAudio(problemId, language, speaker);
  const shouldCompress = compress !== false && compressionConfig.audio.compressMP3;

  return uploadToR2(
    key,
    audioBuffer,
    'audio/mpeg',
    { problemId, language, speaker, type: 'audio' },
    shouldCompress,
  );
}

/**
 * 画像ファイルをR2にアップロード
 */
export async function uploadImageToR2(
  imageBuffer: Buffer,
  problemId: string,
  imageType: 'composite',
  compress?: boolean,
): Promise<string> {
  if (compressionConfig.image.useWebP) {
    return uploadImageAsWebPToR2(
      imageBuffer,
      problemId,
      imageType,
      compressionConfig.image.webpQuality,
    );
  }

  const key = R2AssetKey.forImage(problemId, 'png');
  const shouldCompress = compress !== false && compressionConfig.image.pngCompression;

  return uploadToR2(
    key,
    imageBuffer,
    'image/png',
    { problemId, imageType, type: 'image' },
    shouldCompress,
  );
}

/**
 * 画像ファイルをWebP形式でR2にアップロード（より高い圧縮率）
 * sharpライブラリが必要
 */
export async function uploadImageAsWebPToR2(
  imageBuffer: Buffer,
  problemId: string,
  imageType: 'composite',
  quality: number = compressionConfig.image.webpQuality,
): Promise<string> {
  try {
    // sharpライブラリをdynamic importで読み込み
    const sharp = (await import('sharp')).default;

    // WebP形式に変換（品質設定で圧縮率調整）
    const webpBuffer = await sharp(imageBuffer).webp({ quality }).toBuffer();

    const key = R2AssetKey.forImage(problemId, 'webp');

    console.log(
      `[R2] WebP変換: ${imageBuffer.length} → ${webpBuffer.length} bytes (${Math.round((1 - webpBuffer.length / imageBuffer.length) * 100)}% 削減)`,
    );

    return uploadToR2(
      key,
      webpBuffer,
      'image/webp',
      { problemId, imageType, type: 'image', format: 'webp', quality: quality.toString() },
      false, // WebPは既に圧縮済みなのでgzip圧縮は無効
    );
  } catch (error) {
    console.error('[R2] WebP変換エラーの詳細:', error);
    console.warn('[R2] WebP変換に失敗、PNG形式でアップロード');

    // フォールバック: 通常のPNG形式でアップロード（無限ループを防ぐため直接処理）
    const key = R2AssetKey.forImage(problemId, 'png');
    const shouldCompress = compressionConfig.image.pngCompression;

    return uploadToR2(
      key,
      imageBuffer,
      'image/png',
      { problemId, imageType, type: 'image' },
      shouldCompress,
    );
  }
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
 * R2からファイルを削除
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = createR2Client();

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
  console.log(`[R2] Deleted file: ${key}`);
}

/**
 * URLからキーを抽出してR2から削除
 */
export async function deleteFromR2ByUrl(urlOrKey: string): Promise<void> {
  const t = urlOrKey.trim();
  const key =
    t.startsWith('http://') || t.startsWith('https://')
      ? new URL(t).pathname.replace(/^\//, '')
      : t.replace(/^\/+/, '');
  await deleteFromR2(key);
}

/**
 * 複数のファイルをR2から削除（ロールバック用）
 */
export async function deleteMultipleFromR2(urls: string[]): Promise<void> {
  const promises = urls.map((url) =>
    deleteFromR2ByUrl(url).catch((err) => {
      console.error(`[R2] Failed to delete ${url}:`, err);
    }),
  );

  await Promise.all(promises);
}

/**
 * ファイルキーからパブリックURLを生成
 */
export function getR2PublicUrl(key: string): string {
  return `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
}
