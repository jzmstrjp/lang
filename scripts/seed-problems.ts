#!/usr/bin/env tsx

/**
 * 問題データをデータベースにシードするスクリプト
 * 複数のprobremファイルに対応
 */

import { PrismaClient } from '@prisma/client';
import { SeedProblemData, CreateProblemData } from '../src/types/problem';
import { WORD_COUNT_RULES, type ProblemLength } from '../src/app/api/problem/generate/route';
import path from 'path';
import fs from 'fs';

// Prismaクライアントをシングルトンとして管理
let prisma: PrismaClient | null = null;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error'],
    });
  }
  return prisma;
}

/**
 * 英文の単語数を計算する
 */
function calculateWordCount(englishSentence: string): number {
  // 基本的な単語分割（空白、句読点を考慮）
  const words = englishSentence
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length;
}

/**
 * データセット内の英文単語数分布を分析する
 */
function analyzeWordCountDistribution(seedData: SeedProblemData[]): void {
  const distribution = seedData.map((problem) => {
    const wordCount = calculateWordCount(problem.englishSentence);
    return { wordCount, sentence: problem.englishSentence };
  });

  // WORD_COUNT_RULESを使って動的に統計情報を作成
  const stats: Record<ProblemLength, { count: number; example?: string }> = {} as any;

  (['short', 'medium', 'long'] as ProblemLength[]).forEach((type) => {
    const rule = WORD_COUNT_RULES[type];
    const filtered = distribution.filter((d) => d.wordCount >= rule.min && d.wordCount <= rule.max);
    stats[type] = {
      count: filtered.length,
      example: filtered.length > 0 ? filtered[0].sentence : undefined,
    };
  });

  console.log('\n📊 単語数分布分析:');
  console.log(
    `  🟢 Short (${WORD_COUNT_RULES.short.min}-${WORD_COUNT_RULES.short.max}語): ${stats.short.count}個`,
  );
  console.log(
    `  🟡 Medium (${WORD_COUNT_RULES.medium.min}-${WORD_COUNT_RULES.medium.max}語): ${stats.medium.count}個`,
  );
  console.log(`  🔴 Long (${WORD_COUNT_RULES.long.min}語以上): ${stats.long.count}個`);

  // 各カテゴリの例を表示
  if (stats.short.example) {
    const example = distribution.find((d) => d.sentence === stats.short.example);
    console.log(`    例: "${stats.short.example}" (${example?.wordCount}語)`);
  }
  if (stats.medium.example) {
    const example = distribution.find((d) => d.sentence === stats.medium.example);
    console.log(`    例: "${stats.medium.example}" (${example?.wordCount}語)`);
  }
  if (stats.long.example) {
    const example = distribution.find((d) => d.sentence === stats.long.example);
    console.log(`    例: "${stats.long.example}" (${example?.wordCount}語)`);
  }
}

/**
 * 動的にprobremファイルをインポートする
 */
async function importProbremFile(filePath: string): Promise<SeedProblemData[]> {
  try {
    // ESModuleとCommonJSの両方に対応
    const importedModule = await import(filePath);
    return importedModule.default || importedModule;
  } catch (error) {
    console.error(`❌ ファイルの読み込みに失敗: ${filePath}`, error);
    throw error;
  }
}

/**
 * probremDataディレクトリ内のすべての.tsファイルを取得
 */
function getProbremFiles(): string[] {
  const probremDir = path.join(process.cwd(), 'probremData');

  if (!fs.existsSync(probremDir)) {
    throw new Error(`probremDataディレクトリが見つかりません: ${probremDir}`);
  }

  const files = fs
    .readdirSync(probremDir)
    .filter((file) => file.endsWith('.ts') && file.startsWith('probrem'))
    .map((file) => path.join(probremDir, file));

  if (files.length === 0) {
    throw new Error('probremファイルが見つかりません');
  }

  return files;
}

/**
 * seedデータをCreateProblemDataに変換
 * 各問題の英文単語数を計算して追加
 */
function transformSeedData(seedData: SeedProblemData[]): CreateProblemData[] {
  return seedData.map((problem) => ({
    ...problem,
    wordCount: calculateWordCount(problem.englishSentence),
    // incorrectOptionsはJSON形式で保存
    incorrectOptions: problem.incorrectOptions,
  }));
}

/**
 * メイン処理
 */
async function main() {
  const prismaClient = getPrismaClient();

  try {
    console.log('🌱 データベースシード開始...');

    // コマンドライン引数でファイルを指定できる
    const specifiedFile = process.argv[2];
    let filesToProcess: string[];

    if (specifiedFile) {
      // 特定ファイルの処理
      const fullPath = path.resolve(specifiedFile);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`指定されたファイルが見つかりません: ${fullPath}`);
      }
      filesToProcess = [fullPath];
      console.log(`📄 指定ファイルを処理: ${specifiedFile}`);
    } else {
      // 全probremファイルの処理
      filesToProcess = getProbremFiles();
      console.log(`📁 ${filesToProcess.length}個のprobremファイルを発見`);
    }

    let totalInserted = 0;

    for (const filePath of filesToProcess) {
      const filename = path.basename(filePath);
      console.log(`\n📝 処理中: ${filename}`);

      // データを読み込み
      const seedData = await importProbremFile(filePath);
      console.log(`📊 ${seedData.length}個の問題を発見`);

      // 単語数分布を分析
      analyzeWordCountDistribution(seedData);

      // 重複チェック
      const uniqueKeys = new Set(seedData.map((p) => `${p.englishSentence}||${p.japaneseReply}`));
      const duplicateCount = seedData.length - uniqueKeys.size;
      if (duplicateCount > 0) {
        console.log(`⚠️  データ内重複: ${duplicateCount}個`);
      }

      // データを変換（各問題の英文単語数に基づいてlengthTypeを決定）
      const createData = transformSeedData(seedData);

      // バッチ挿入
      try {
        const result = await prismaClient.problem.createMany({
          data: createData,
          skipDuplicates: true, // 重複をスキップ
        });

        const skippedCount = createData.length - result.count;
        console.log(`✅ ${result.count}個の問題を挿入 (${filename})`);
        if (skippedCount > 0) {
          console.log(`⏭️  ${skippedCount}個をスキップ (DB重複)`);
        }
        totalInserted += result.count;
      } catch (error) {
        console.error(`❌ 挿入エラー (${filename}):`, error);
        throw error;
      }
    }

    console.log(`\n🎉 シード完了! 合計 ${totalInserted}個の問題を挿入しました`);

    // 挿入後の統計を表示
    const stats = await prismaClient.problem.groupBy({
      by: ['wordCount'],
      _count: true,
    });

    console.log('\n📈 データベース統計:');
    stats.forEach((stat) => {
      console.log(`  ${stat.wordCount}語: ${stat._count}個`);
    });
  } catch (error) {
    console.error('❌ シードエラー:', error);
    throw error;
  } finally {
    await prismaClient.$disconnect();
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
