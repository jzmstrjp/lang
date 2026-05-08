#!/usr/bin/env tsx

/**
 * problemsテーブルの全問題をAIで採点し、スコアが低い問題を削除するスクリプト
 *
 * 採点基準:
 *   - 要件文は @/prompts/problem-dialogue-prompts と create-problems2 生成で共有
 *   - englishSentence / japaneseSentence / englishReply / japaneseReply
 *
 * 使用方法:
 *   npx tsx scripts/score-and-prune-problems.ts [オプション]
 *
 * オプション:
 *   --threshold <N>   削除する点数の閾値（デフォルト: 80）
 *   --limit <N>       採点する問題数の上限（デフォルト: 全件）
 *   --dry-run         採点のみ行い削除はしない（低スコア問題を tmp/low-score-problems.json に保存）
 *   --from-file       tmp/low-score-problems.json の問題を一括削除する
 *   --batch-size <N>  並列処理のバッチサイズ（デフォルト: 5）
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { TEXT_MODEL } from '@/const';
import {
  buildScoreProblemUserPrompt,
  type ScoreProblemInput,
} from '@/prompts/problem-dialogue-prompts';
import { deleteMultipleFromR2 } from '../src/lib/r2-client';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prisma = new PrismaClient({ log: ['error'] });

const DRY_RUN_OUTPUT_PATH = path.join(process.cwd(), 'tmp', 'low-score-problems.json');

type ProblemScore = {
  score: number;
  reason: string;
};

type LowScoreEntry = {
  id: string;
  score: number;
  reason: string;
  englishSentence: string;
  japaneseSentence: string;
  englishReply: string;
  japaneseReply: string;
};

/**
 * dry-run 時にスコア不足の問題を JSON ファイルへ追記する（重複IDは上書き）
 */
function appendLowScoreEntry(entry: LowScoreEntry): void {
  const dir = path.dirname(DRY_RUN_OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing: LowScoreEntry[] = [];
  if (fs.existsSync(DRY_RUN_OUTPUT_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(DRY_RUN_OUTPUT_PATH, 'utf-8')) as LowScoreEntry[];
    } catch {
      existing = [];
    }
  }

  const idx = existing.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    existing[idx] = entry;
  } else {
    existing.push(entry);
  }

  fs.writeFileSync(DRY_RUN_OUTPUT_PATH, JSON.stringify(existing, null, 2), 'utf-8');
}

type ProblemRecord = {
  id: string;
  englishSentence: string;
  japaneseSentence: string;
  englishReply: string;
  japaneseReply: string;
  imageUrl: string | null;
  audioEnUrl: string | null;
  audioEnReplyUrl: string | null;
  audioJaUrl: string | null;
};

/**
 * 1問題を採点して0〜100のスコアを返す
 */
export async function scoreProblem(problem: ScoreProblemInput): Promise<ProblemScore> {
  const prompt = buildScoreProblemUserPrompt(problem);

  const response = await openai.responses.create({
    model: TEXT_MODEL,
    input: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  if (response.status === 'incomplete') {
    const detail = response.incomplete_details?.reason ?? 'unknown';
    throw new Error(`GPTレスポンスが不完全です（reason: ${detail}）`);
  }

  const content = response.output_text;
  if (!content) {
    throw new Error('GPTからのレスポンスが空です');
  }

  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : content;

  const result = JSON.parse(jsonText.trim()) as unknown;

  if (
    typeof result !== 'object' ||
    result === null ||
    typeof (result as Record<string, unknown>).score !== 'number' ||
    typeof (result as Record<string, unknown>).reason !== 'string'
  ) {
    throw new Error(`無効なレスポンス形式: ${jsonText}`);
  }

  const score = Math.min(100, Math.max(0, Math.round((result as { score: number }).score)));
  const reason = (result as { reason: string }).reason;

  return { score, reason };
}

type AssetRecord = Pick<
  ProblemRecord,
  'id' | 'imageUrl' | 'audioEnUrl' | 'audioEnReplyUrl' | 'audioJaUrl'
>;

/**
 * 問題をDBとR2から完全に削除する
 */
async function deleteProblem(problem: AssetRecord): Promise<void> {
  await prisma.problem.delete({ where: { id: problem.id } });

  const assetUrls = [
    problem.imageUrl,
    problem.audioEnUrl,
    problem.audioEnReplyUrl,
    problem.audioJaUrl,
  ].filter((url): url is string => typeof url === 'string' && url.length > 0);

  if (assetUrls.length > 0) {
    await deleteMultipleFromR2(assetUrls);
  }
}

/**
 * 問題を並列バッチで採点する。
 * dryRun=true かつ score < threshold の場合は採点後すぐにファイルへ追記する。
 */
async function scoreProblemsInBatch(
  problems: ProblemRecord[],
  batchSize: number,
  threshold: number,
  dryRun: boolean,
): Promise<Map<string, ProblemScore>> {
  const results = new Map<string, ProblemScore>();

  for (let i = 0; i < problems.length; i += batchSize) {
    const batch = problems.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (problem) => {
        try {
          const score = await scoreProblem({
            englishSentence: problem.englishSentence,
            japaneseSentence: problem.japaneseSentence,
            englishReply: problem.englishReply,
            japaneseReply: problem.japaneseReply,
          });
          return { problem, score, error: null };
        } catch (error) {
          return {
            problem,
            score: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    for (const result of batchResults) {
      if (result.score !== null) {
        results.set(result.problem.id, result.score);

        if (dryRun && result.score.score < threshold) {
          appendLowScoreEntry({
            id: result.problem.id,
            score: result.score.score,
            reason: result.score.reason,
            englishSentence: result.problem.englishSentence,
            japaneseSentence: result.problem.japaneseSentence,
            englishReply: result.problem.englishReply,
            japaneseReply: result.problem.japaneseReply,
          });
        }
      } else {
        console.error(`  ❌ [${result.problem.id}] 採点エラー: ${result.error}`);
      }
    }

    console.log(
      `  📊 バッチ ${Math.floor(i / batchSize) + 1}/${Math.ceil(problems.length / batchSize)} 完了 (${Math.min(i + batchSize, problems.length)}/${problems.length}件)`,
    );
  }

  return results;
}

async function main(options: {
  threshold: number;
  limit: number | null;
  dryRun: boolean;
  batchSize: number;
}) {
  const { threshold, limit, dryRun, batchSize } = options;

  console.log('🚀 問題採点・削除スクリプトを開始します');
  console.log(`📋 設定:`);
  console.log(`   削除閾値: ${threshold}点未満`);
  console.log(`   採点上限: ${limit ?? '全件'}`);
  console.log(`   バッチサイズ: ${batchSize}`);
  console.log(`   ドライラン: ${dryRun ? 'YES（削除しない）' : 'NO（削除する）'}\n`);

  const requiredEnvs = ['OPENAI_API_KEY', 'DATABASE_URL'];
  const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);
  if (missingEnvs.length > 0) {
    console.error('❌ 必要な環境変数が設定されていません:');
    missingEnvs.forEach((env) => console.error(`  - ${env}`));
    process.exit(1);
  }

  console.log('📋 問題を取得中...');
  const problems = await prisma.problem.findMany({
    select: {
      id: true,
      englishSentence: true,
      japaneseSentence: true,
      englishReply: true,
      japaneseReply: true,
      imageUrl: true,
      audioEnUrl: true,
      audioEnReplyUrl: true,
      audioJaUrl: true,
    },
    ...(limit !== null ? { take: limit } : {}),
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 ${problems.length}件の問題を取得しました\n`);

  if (problems.length === 0) {
    console.log('✅ 採点対象の問題がありません');
    return;
  }

  console.log(`🤖 採点を開始します（バッチサイズ: ${batchSize}）...\n`);
  const totalStartTime = Date.now();

  if (dryRun) {
    console.log(`📁 低スコア問題の保存先: ${DRY_RUN_OUTPUT_PATH}\n`);
  }

  const scoreMap = await scoreProblemsInBatch(problems, batchSize, threshold, dryRun);

  console.log(`\n📊 採点完了: ${scoreMap.size}/${problems.length}件`);

  // スコアの分布を表示
  const scores = Array.from(scoreMap.values()).map((s) => s.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sorted = [...scores].toSorted((a, b) => a - b);
  console.log(`\n📈 スコア統計:`);
  console.log(`   平均: ${avg.toFixed(1)}点`);
  console.log(`   最低: ${sorted[0]}点`);
  console.log(`   最高: ${sorted[sorted.length - 1]}点`);
  console.log(`   中央値: ${sorted[Math.floor(sorted.length / 2)]}点`);

  const lowScoreCount = scores.filter((s) => s < threshold).length;
  console.log(`\n🗑️ 削除対象（${threshold}点未満）: ${lowScoreCount}件\n`);

  // 採点結果を詳細表示
  const problemsWithScores = problems
    .filter((p) => scoreMap.has(p.id))
    .map((p) => ({ ...p, ...scoreMap.get(p.id)! }))
    .toSorted((a, b) => a.score - b.score);

  console.log('📋 採点結果（低スコア順）:');
  for (const p of problemsWithScores) {
    const mark = p.score < threshold ? '🗑️ ' : '✅ ';
    console.log(`  ${mark}[${p.score}点] ${p.englishSentence.substring(0, 60)}...`);
    console.log(`       理由: ${p.reason}`);
  }

  // 削除処理
  const toDelete = problemsWithScores.filter((p) => p.score < threshold);

  if (toDelete.length === 0) {
    console.log('\n✅ 削除対象の問題はありません');
  } else if (dryRun) {
    console.log(`\n⚠️  ドライランモードのため ${toDelete.length}件の削除をスキップします`);
    console.log(`📁 低スコア問題を保存済み: ${DRY_RUN_OUTPUT_PATH}`);
    console.log(`   削除を実行するには以下を実行してください:`);
    console.log(`   npm run score-and-prune -- --from-file`);
    console.log(`   ※ または --dry-run なしで再実行`);
  } else {
    console.log(`\n🗑️  ${toDelete.length}件の問題を削除します...`);
    let deleteSuccessCount = 0;
    let deleteErrorCount = 0;

    for (const [index, problem] of toDelete.entries()) {
      try {
        console.log(
          `  🗑️  [${index + 1}/${toDelete.length}] 削除中: ${problem.id} (${problem.score}点)`,
        );
        await deleteProblem(problem);
        deleteSuccessCount++;
        console.log(`  ✅ 削除完了: ${problem.id}`);
      } catch (error) {
        deleteErrorCount++;
        console.error(`  ❌ 削除エラー: ${problem.id}`, error);
      }
    }

    console.log(`\n🗑️  削除結果: 成功 ${deleteSuccessCount}件 / エラー ${deleteErrorCount}件`);
  }

  const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(1);

  console.log(`\n🎊 ===============================================`);
  console.log(`✅ スクリプト完了 (${totalDuration}秒)`);
  console.log(`   採点: ${scoreMap.size}件`);
  console.log(`   削除対象: ${lowScoreCount}件（${threshold}点未満）`);
  if (!dryRun) {
    console.log(`   実際に削除: ${toDelete.length}件`);
  }
  console.log(`🎊 ===============================================`);
}

/**
 * tmp/low-score-problems.json に記録された問題を一括削除する
 */
async function deleteFromFile(): Promise<void> {
  if (!fs.existsSync(DRY_RUN_OUTPUT_PATH)) {
    console.error(`❌ ファイルが見つかりません: ${DRY_RUN_OUTPUT_PATH}`);
    console.error('   先に --dry-run で採点を実行してください');
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(DRY_RUN_OUTPUT_PATH, 'utf-8')) as LowScoreEntry[];

  if (entries.length === 0) {
    console.log('✅ 削除対象の問題がありません（ファイルが空）');
    return;
  }

  console.log(`🚀 ファイルから一括削除を開始します: ${entries.length}件`);
  console.log(`📁 ソース: ${DRY_RUN_OUTPUT_PATH}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const [index, entry] of entries.entries()) {
    try {
      console.log(`  🗑️  [${index + 1}/${entries.length}] ${entry.id} (${entry.score}点)`);
      console.log(`       "${entry.englishSentence.substring(0, 60)}..."`);

      const record = await prisma.problem.findUnique({
        where: { id: entry.id },
        select: {
          id: true,
          imageUrl: true,
          audioEnUrl: true,
          audioEnReplyUrl: true,
          audioJaUrl: true,
        },
      });

      if (!record) {
        console.log(`  ⚠️  スキップ（既に削除済み）: ${entry.id}`);
        successCount++;
        continue;
      }

      await deleteProblem(record);
      successCount++;
      console.log(`  ✅ 削除完了: ${entry.id}`);
    } catch (error) {
      errorCount++;
      console.error(`  ❌ 削除エラー: ${entry.id}`, error);
    }
  }

  console.log(`\n🎊 ===============================================`);
  console.log(`✅ 一括削除完了`);
  console.log(`   成功: ${successCount}件 / エラー: ${errorCount}件`);
  console.log(`🎊 ===============================================`);

  if (errorCount === 0) {
    fs.unlinkSync(DRY_RUN_OUTPUT_PATH);
    console.log(`🧹 ${DRY_RUN_OUTPUT_PATH} を削除しました`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  let threshold = 80;
  let limit: number | null = null;
  let dryRun = false;
  let batchSize = 5;
  let fromFile = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--threshold' && args[i + 1]) {
      const parsed = parseInt(args[++i]!, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        console.error('❌ --threshold は 0〜100 の整数で指定してください');
        process.exit(1);
      }
      threshold = parsed;
    } else if (arg === '--limit' && args[i + 1]) {
      const parsed = parseInt(args[++i]!, 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error('❌ --limit は正の整数で指定してください');
        process.exit(1);
      }
      limit = parsed;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--from-file') {
      fromFile = true;
    } else if (arg === '--batch-size' && args[i + 1]) {
      const parsed = parseInt(args[++i]!, 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error('❌ --batch-size は正の整数で指定してください');
        process.exit(1);
      }
      batchSize = parsed;
    }
  }

  (async () => {
    try {
      if (fromFile) {
        await deleteFromFile();
      } else {
        await main({ threshold, limit, dryRun, batchSize });
      }
      process.exit(0);
    } catch (error) {
      console.error('❌ スクリプト実行エラー:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
