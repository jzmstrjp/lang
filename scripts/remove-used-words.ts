#!/usr/bin/env tsx

/**
 * docs/words.ts および docs/kids_words.ts から使用済みの単語を削除するスクリプト
 *
 * LATEST_USED_WORD / LATEST_USED_WORD_KIDS までの単語（その単語自身を含む）を
 * それぞれの配列から取り除き、ファイルを上書き保存する。
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { words } from '../docs/words';
import { words as kidsWords } from '../docs/kids_words';

async function removeUsedWords(
  configKey: string,
  wordList: string[],
  relativeFilePath: string,
  exportName: string,
) {
  const config = await prisma.appConfig.findUnique({
    where: { key: configKey },
  });

  if (!config) {
    console.log(`${configKey} が未設定のため、スキップします。`);
    return;
  }

  const latestUsedWord = config.value;
  const idx = wordList.indexOf(latestUsedWord);

  if (idx === -1) {
    console.log(
      `⚠️ ${configKey} "${latestUsedWord}" が ${relativeFilePath} に見つかりません。スキップします。`,
    );
    return;
  }

  const removedWords = wordList.slice(0, idx + 1);
  const remainingWords = wordList.slice(idx + 1);

  console.log(`\n[${configKey}]`);
  console.log(`  最終使用単語: "${latestUsedWord}" (インデックス: ${idx})`);
  console.log(`  削除する単語数: ${removedWords.length}`);
  console.log(`  残る単語数: ${remainingWords.length}`);

  const lines = [
    `export const ${exportName}: string[] = [`,
    ...remainingWords.map((w) => `  '${w}',`),
    '];',
    '',
  ].join('\n');

  const filePath = path.resolve(__dirname, `../${relativeFilePath}`);
  fs.writeFileSync(filePath, lines, 'utf-8');

  console.log(`  ✅ ${relativeFilePath} を更新しました。`);
}

async function main() {
  try {
    await removeUsedWords('LATEST_USED_WORD', words, 'docs/words.ts', 'words');
    await removeUsedWords('LATEST_USED_WORD_KIDS', kidsWords, 'docs/kids_words.ts', 'words');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
