#!/usr/bin/env tsx

/**
 * R2の audio/ と images/ 配下のオブジェクトを全て削除するスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/delete-r2-media.ts
 *
 * dry-run（削除せず一覧表示のみ）:
 *   DRY_RUN=true npx tsx scripts/delete-r2-media.ts
 */

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type ObjectIdentifier,
} from '@aws-sdk/client-s3';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local' });

const CLOUDFLARE_ACCOUNT_ID = 'd6440650d9139a91a55c362227fb9310';
const R2_ENDPOINT = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'prod-lang-media-apac';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';

const PREFIXES = ['audio/', 'images/'];
const DELETE_BATCH_SIZE = 1000; // S3/R2 の DeleteObjects の上限

function createClient() {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_ACCESS_KEY_ID と R2_SECRET_ACCESS_KEY を環境変数に設定してください');
  }
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    tls: true,
  });
}

async function listAllKeys(client: S3Client, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const res = await client.send(command);
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function deleteKeys(client: S3Client, keys: string[]) {
  for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
    const objects: ObjectIdentifier[] = batch.map((k) => ({ Key: k }));
    const command = new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: { Objects: objects, Quiet: true },
    });
    const res = await client.send(command);
    if (res.Errors && res.Errors.length > 0) {
      console.error('[R2] 削除エラー:', res.Errors);
    }
    console.log(`[R2] 削除完了: ${batch.length} 件 (${i + batch.length} / ${keys.length})`);
  }
}

async function main() {
  console.log(`[R2] バケット: ${R2_BUCKET_NAME}`);
  console.log(`[R2] 対象プレフィックス: ${PREFIXES.join(', ')}`);
  if (DRY_RUN) console.log('[R2] *** DRY RUN モード（実際には削除しません）***');

  const client = createClient();

  for (const prefix of PREFIXES) {
    console.log(`\n[R2] 一覧取得中: ${prefix} ...`);
    const keys = await listAllKeys(client, prefix);
    console.log(`[R2] ${prefix} : ${keys.length} 件`);

    if (keys.length === 0) continue;

    if (DRY_RUN) {
      keys.slice(0, 10).forEach((k) => console.log(`  ${k}`));
      if (keys.length > 10) console.log(`  ... (他 ${keys.length - 10} 件)`);
      continue;
    }

    await deleteKeys(client, keys);
  }

  console.log('\n[R2] 完了');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
