#!/usr/bin/env tsx

/**
 * 既存問題の語彙を分析し、追加すべき expression 候補を AI で提案するスクリプト。
 *
 * Usage:
 *   tsx scripts/suggest-words.ts              # dry run（提案のみ表示）
 *   tsx scripts/suggest-words.ts --save       # DB に保存
 *   tsx scripts/suggest-words.ts --sample=50  # englishSentence のサンプル件数を指定（デフォルト: 100）
 *   tsx scripts/suggest-words.ts --save --clear  # word テーブルを全件削除してから保存
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { suggestWordsForCategory } from '@/lib/word-suggester';

dotenv.config();

const prisma = new PrismaClient({ log: ['error'] });

// ─── CLI 引数 ─────────────────────────────────────────────────────────────────

function parseArgs(): { save: boolean; clear: boolean; sampleCount: number } {
  const args = process.argv.slice(2);
  const save = args.includes('--save');
  const clear = args.includes('--clear');
  const sampleArg = args.find((a) => a.startsWith('--sample='));
  const sampleCount = sampleArg ? parseInt(sampleArg.slice('--sample='.length), 10) : 100;
  return { save, clear, sampleCount };
}

// ─── DB からデータ取得 ────────────────────────────────────────────────────────

async function fetchExistingExpressions(): Promise<string[]> {
  const rows = await prisma.problem.findMany({
    select: { expression: true },
  });
  return [...new Set(rows.map((r) => r.expression))];
}

async function fetchExistingWords(): Promise<{ expression: string; isKids: boolean }[]> {
  return prisma.word.findMany({ select: { expression: true, isKids: true } });
}

async function fetchSampleSentences(count: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ englishSentence: string }[]>`
    SELECT "englishSentence" FROM problems ORDER BY RANDOM() LIMIT ${count}
  `;
  return rows.map((r) => r.englishSentence);
}

// ─── メイン ──────────────────────────────────────────────────────────────────

async function main() {
  const { save, clear, sampleCount } = parseArgs();

  if (clear && save) {
    console.log(`🗑️ word テーブルを全件削除中...`);
    const deleted = await prisma.word.deleteMany({});
    console.log(`  - 削除完了: ${deleted.count}件`);
  }

  console.log(`🔍 DB からデータを取得中...`);
  const [existingExpressions, existingWords, sampleSentences] = await Promise.all([
    fetchExistingExpressions(),
    fetchExistingWords(),
    fetchSampleSentences(sampleCount),
  ]);

  console.log(`  - 既存 expression: ${existingExpressions.length}件`);
  console.log(`  - 既存 words テーブル: ${existingWords.length}件`);
  console.log(`  - englishSentence サンプル: ${sampleSentences.length}件`);

  console.log(`\n🤖 AI に候補を生成中（kids）...`);
  const kidsSuggestions = await suggestWordsForCategory(
    true,
    existingExpressions,
    existingWords,
    sampleSentences,
  );

  console.log(`🤖 AI に候補を生成中（non-kids）...`);
  const nonKidsSuggestions = await suggestWordsForCategory(
    false,
    existingExpressions,
    existingWords,
    sampleSentences,
  );

  console.log(`\n📋 提案された expression:\n`);
  console.log(`👶 kids（${kidsSuggestions.length}件）`);
  console.log(kidsSuggestions.join(', '));
  console.log();
  console.log(`🧑 non-kids（${nonKidsSuggestions.length}件）`);
  console.log(nonKidsSuggestions.join(', '));

  if (!save) {
    console.log('\nℹ️  dry run モードです。--save を付けると DB に保存します。');
    return;
  }

  const allSuggestions = [
    ...kidsSuggestions.map((expression) => ({ expression, isKids: true })),
    ...nonKidsSuggestions.map((expression) => ({ expression, isKids: false })),
  ];

  console.log('\n💾 DB に保存中...');
  const result = await prisma.word.createMany({
    data: allSuggestions,
    skipDuplicates: true,
  });
  console.log(
    `✅ 保存完了: ${result.count}件（重複スキップ: ${allSuggestions.length - result.count}件）`,
  );
}

main()
  .catch((e) => {
    console.error('❌ エラー:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
