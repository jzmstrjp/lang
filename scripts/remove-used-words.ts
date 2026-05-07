#!/usr/bin/env tsx

/**
 * docs/words.ts から使用済みの単語を削除するスクリプト
 *
 * LATEST_USED_WORD までの単語（その単語自身を含む）を words 配列から取り除き、
 * docs/words.ts を上書き保存する。
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { words } from '../docs/words';

async function main() {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: 'LATEST_USED_WORD' },
    });

    if (!config) {
      console.log('LATEST_USED_WORD が未設定のため、何もしません。');
      return;
    }

    const latestUsedWord = config.value;
    const idx = words.indexOf(latestUsedWord);

    if (idx === -1) {
      console.log(
        `⚠️ LATEST_USED_WORD "${latestUsedWord}" が words に見つかりません。何もしません。`,
      );
      return;
    }

    const removedWords = words.slice(0, idx + 1);
    const remainingWords = words.slice(idx + 1);

    console.log(`LATEST_USED_WORD: "${latestUsedWord}" (インデックス: ${idx})`);
    console.log(`削除する単語数: ${removedWords.length}`);
    console.log(`残る単語数: ${remainingWords.length}`);

    const lines = [
      'export const words: string[] = [',
      ...remainingWords.map((w) => `  '${w}',`),
      '];',
      '',
    ].join('\n');

    const wordsFilePath = path.resolve(__dirname, '../docs/words.ts');
    fs.writeFileSync(wordsFilePath, lines, 'utf-8');

    console.log(`\n✅ docs/words.ts を更新しました。`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
