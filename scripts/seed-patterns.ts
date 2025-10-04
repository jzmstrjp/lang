#!/usr/bin/env tsx

/**
 * パターン学習データをデータベースにシードするスクリプト
 */

import { PrismaClient } from '@prisma/client';
import { SeedProblemData } from '../src/types/problem';
import path from 'path';
import fs from 'fs';

// Prismaクライアントをシングルトンとして管理
let prisma: PrismaClient | null = null;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  return prisma;
}

/**
 * 英文の単語数を計算する
 */
function calculateWordCount(englishSentence: string): number {
  const words = englishSentence
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  return words.length;
}

/**
 * パターンデータの型
 */
type PatternData = {
  patternName: string;
  correctAnswer: string;
  incorrectOptions: string[];
  examples: SeedProblemData[];
};

/**
 * 動的にpatternファイルをインポートする
 */
async function importPatternFile(filePath: string): Promise<PatternData> {
  try {
    const importedModule = await import(filePath);
    return importedModule.default || importedModule;
  } catch (error) {
    console.error(`❌ ファイルの読み込みに失敗: ${filePath}`, error);
    throw error;
  }
}

/**
 * patternDataディレクトリ内のすべての.tsファイルを取得
 */
function getPatternFiles(): string[] {
  const patternDir = path.join(process.cwd(), 'patternData');

  if (!fs.existsSync(patternDir)) {
    throw new Error(`patternDataディレクトリが見つかりません: ${patternDir}`);
  }

  const files = fs
    .readdirSync(patternDir)
    .filter((file) => file.endsWith('.ts') && file.startsWith('pattern'))
    .sort() // pattern1.ts, pattern2.ts, ... の順に処理
    .map((file) => path.join(patternDir, file));

  if (files.length === 0) {
    throw new Error('patternファイルが見つかりません');
  }

  return files;
}

/**
 * メイン処理
 */
async function main() {
  const prismaClient = getPrismaClient();

  try {
    console.log('🌱 パターン学習データのシード開始...');

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
      // 全patternファイルの処理
      filesToProcess = getPatternFiles();
      console.log(`📁 ${filesToProcess.length}個のpatternファイルを発見`);
    }

    let totalPatterns = 0;
    let totalExamples = 0;

    for (const filePath of filesToProcess) {
      const filename = path.basename(filePath);
      console.log(`\n📝 処理中: ${filename}`);

      // パターンデータを読み込み
      const patternData = await importPatternFile(filePath);
      console.log(`  パターン名: ${patternData.patternName}`);
      console.log(`  例文数: ${patternData.examples.length}個`);

      // PatternSetを作成
      const patternSet = await prismaClient.patternSet.create({
        data: {
          patternName: patternData.patternName,
          correctAnswer: patternData.correctAnswer,
          incorrectOptions: patternData.incorrectOptions,
        },
      });

      console.log(`✅ PatternSet作成: ${patternSet.id}`);
      totalPatterns++;

      // 各例文をProblemとして挿入（重複はスキップ）
      let insertedExamples = 0;
      let skippedExamples = 0;

      for (const example of patternData.examples) {
        try {
          // 既存のProblemをチェック（englishSentenceのユニーク制約）
          const existing = await prismaClient.problem.findUnique({
            where: {
              englishSentence: example.englishSentence,
            },
          });

          if (existing) {
            console.log(`  ⏭️  スキップ (既存): "${example.englishSentence}"`);
            // 既存のProblemにpatternIdを紐付ける
            await prismaClient.problem.update({
              where: { id: existing.id },
              data: { patternId: patternSet.id },
            });
            console.log(`    → patternIdを更新: ${patternSet.id}`);
            skippedExamples++;
          } else {
            // 新規作成
            await prismaClient.problem.create({
              data: {
                wordCount: calculateWordCount(example.englishSentence),
                englishSentence: example.englishSentence,
                japaneseSentence: example.japaneseSentence,
                japaneseReply: example.japaneseReply,
                englishReply: example.englishReply,
                incorrectOptions: example.incorrectOptions,
                senderVoice: example.senderVoice,
                senderRole: example.senderRole,
                receiverVoice: example.receiverVoice,
                receiverRole: example.receiverRole,
                place: example.place,
                audioEnUrl: null,
                audioJaUrl: null,
                audioEnReplyUrl: null,
                imageUrl: null,
                audioReady: false,
                patternId: patternSet.id, // PatternSetに紐付け
              },
            });
            console.log(`  ✅ 例文挿入: "${example.englishSentence}"`);
            insertedExamples++;
          }
        } catch (error) {
          console.error(`  ❌ 例文挿入エラー: "${example.englishSentence}"`, error);
          throw error;
        }
      }

      console.log(
        `  📊 ${filename}: ${insertedExamples}個挿入、${skippedExamples}個スキップ（既存に紐付け）`,
      );
      totalExamples += insertedExamples;
    }

    console.log(`\n🎉 シード完了!`);
    console.log(`  パターンセット: ${totalPatterns}個`);
    console.log(`  新規例文: ${totalExamples}個`);

    // データベース統計
    const patternCount = await prismaClient.patternSet.count();
    const problemCount = await prismaClient.problem.count();
    const patternProblemsCount = await prismaClient.problem.count({
      where: { patternId: { not: null } },
    });

    console.log('\n📈 データベース統計:');
    console.log(`  PatternSet総数: ${patternCount}個`);
    console.log(`  Problem総数: ${problemCount}個`);
    console.log(`  うちパターン学習用: ${patternProblemsCount}個`);
  } catch (error) {
    console.error('❌ シードエラー:', error);
    throw error;
  } finally {
    await prismaClient.$disconnect();
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { main };
