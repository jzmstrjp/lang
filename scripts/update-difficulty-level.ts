#!/usr/bin/env tsx

/**
 * difficultyLevelがnullなProblemsレコードを取得してOpenAI APIで難易度を判定・更新するスクリプト
 */

import { prisma } from '../src/lib/prisma';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { TEXT_MODEL } from '@/const';

// 環境変数を読み込み
dotenv.config();

// OpenAIクライアントを初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

function logTokenUsage(usage: TokenUsage | undefined, context: string) {
  if (!usage) {
    console.log(`ℹ️ ${context}のトークン情報を取得できませんでした`);
    return;
  }

  const {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  } = usage;

  console.log(
    `📊 ${context} トークン使用量: 入力 ${inputTokens ?? '-'} / 出力 ${outputTokens ?? '-'} / 合計 ${totalTokens ?? '-'}`,
  );
}

/**
 * 難易度基準ファイルを読み込む
 */
function loadDifficultyLevelGuide(): string {
  const guidePath = path.join(process.cwd(), 'docs', 'difficulty-level.md');

  if (!fs.existsSync(guidePath)) {
    throw new Error(`難易度基準ファイルが見つかりません: ${guidePath}`);
  }

  return fs.readFileSync(guidePath, 'utf-8');
}

/**
 * OpenAI APIで難易度を判定
 */
async function judgeDifficultyLevel(
  englishSentence: string,
  difficultyGuide: string,
): Promise<{ difficultyLevel: number; reasoning: string }> {
  const prompt = `${difficultyGuide}

## 判定依頼

以下の英文の難易度レベルを1〜10の10段階で判定してください。
上記の基準に従い、文法的複雑さ、語彙の専門性、文の長さ、構文の複雑さ、イディオムの有無などを総合的に判断してください。

**英文**: "${englishSentence}"

**出力形式**: 必ずJSON形式で以下のように返してください。
\`\`\`json
{
  "difficultyLevel": 数値（1〜10の整数）,
  "reasoning": "判定理由（簡潔に日本語で）"
}
\`\`\``;

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 判定の一貫性を重視
    });

    if (response.status === 'incomplete') {
      const detail = response.incomplete_details?.reason ?? 'unknown';
      throw new Error(`GPTからのレスポンスが完了しませんでした（reason: ${detail}）`);
    }

    const content = response.output_text;

    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    logTokenUsage(response.usage, '難易度判定');

    // JSONブロックを抽出
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : content;

    const result = JSON.parse(jsonText.trim());

    // バリデーション
    if (
      typeof result.difficultyLevel !== 'number' ||
      result.difficultyLevel < 1 ||
      result.difficultyLevel > 10 ||
      !Number.isInteger(result.difficultyLevel)
    ) {
      throw new Error(`無効な難易度レベル: ${result.difficultyLevel}（1〜10の整数が必要）`);
    }

    if (typeof result.reasoning !== 'string' || !result.reasoning.trim()) {
      throw new Error('判定理由が空です');
    }

    return {
      difficultyLevel: result.difficultyLevel,
      reasoning: result.reasoning,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`GPT API呼び出しエラー: ${error.message}`);
    }
    throw error;
  }
}

async function main(count: number = 1) {
  try {
    console.log('🚀 難易度レベル更新スクリプトを開始します...');
    console.log(`📊 処理件数: ${count}件\n`);

    // 環境変数のチェック
    const requiredEnvs = ['OPENAI_API_KEY', 'DATABASE_URL'];
    const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

    if (missingEnvs.length > 0) {
      console.error('❌ 必要な環境変数が設定されていません:');
      missingEnvs.forEach((env) => console.error(`  - ${env}`));
      process.exit(1);
    }

    // 難易度基準を読み込み
    console.log('📖 難易度基準ファイルを読み込み中...');
    const difficultyGuide = loadDifficultyLevelGuide();
    console.log('✅ 難易度基準ファイル読み込み完了\n');

    // difficultyLevelがnullのレコードを取得
    console.log('📋 difficultyLevelがnullなレコードを検索中...');

    const problemsWithoutDifficulty = await prisma.problem.findMany({
      where: {
        difficultyLevel: null,
      },
      select: {
        id: true,
        englishSentence: true,
      },
      take: count,
      orderBy: {
        createdAt: 'desc', // 新しいものから処理
      },
    });

    if (problemsWithoutDifficulty.length === 0) {
      console.log('✅ difficultyLevelがnullなレコードは見つかりませんでした');
      return;
    }

    console.log(`📊 ${problemsWithoutDifficulty.length}件のレコードが見つかりました。`);
    console.log('🔄 処理を開始します...\n');

    const totalStartTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    // 各レコードを処理
    for (const [index, problem] of problemsWithoutDifficulty.entries()) {
      const startTime = Date.now();
      try {
        console.log(
          `\n🔄 [${index + 1}/${problemsWithoutDifficulty.length}] 処理開始: ${problem.id}`,
        );
        console.log(`   英文: "${problem.englishSentence}"`);

        // OpenAI APIで難易度を判定
        console.log('   🤖 難易度を判定中...');
        const { difficultyLevel, reasoning } = await judgeDifficultyLevel(
          problem.englishSentence,
          difficultyGuide,
        );

        console.log(`   📈 判定結果: レベル ${difficultyLevel}`);
        console.log(`   💭 理由: ${reasoning}`);

        // データベースを更新
        console.log('   💾 データベースを更新中...');
        await prisma.problem.update({
          where: { id: problem.id },
          data: { difficultyLevel },
        });

        console.log('   ✅ データベース更新完了');

        successCount++;
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   🎉 レコード ${problem.id} の処理が完了しました！ (${duration}秒)`);

        // API制限を考慮して少し待機（次のリクエストまで）
        if (index < problemsWithoutDifficulty.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ レコード ${problem.id} の処理中にエラーが発生:`, error);
        // エラーが発生しても他のレコードの処理を続行
      }
    }

    const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(1);

    if (errorCount > 0) {
      const failureSummary = [
        '\n💥 ===============================================',
        '⚠️ 難易度レベル更新スクリプトが完了しました（一部エラーあり）',
        '💥 ===============================================',
        `📊 処理結果:`,
        `   ✅ 成功: ${successCount}件`,
        `   ❌ エラー: ${errorCount}件`,
        `   📝 合計: ${problemsWithoutDifficulty.length}件`,
        `   ⏱️ 合計時間: ${totalDuration}秒`,
      ];
      failureSummary.forEach((line) => console.error(line));
    } else {
      const successSummary = [
        '\n🎊 ===============================================',
        '✅ 難易度レベル更新スクリプトが完了しました！',
        '🎊 ===============================================',
        `📊 処理結果:`,
        `   ✅ 成功: ${successCount}件`,
        `   ❌ エラー: ${errorCount}件`,
        `   📝 合計: ${problemsWithoutDifficulty.length}件`,
        `   ⏱️ 合計時間: ${totalDuration}秒`,
      ];
      successSummary.forEach((line) => console.log(line));
    }
  } catch (error) {
    console.error('❌ スクリプト実行エラー:', error);
    throw error;
  } finally {
    // Prisma接続をクリーンアップ
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  let count = 1; // デフォルト値

  // 件数の取得
  const countArg = args[0];
  if (countArg) {
    const parsed = parseInt(countArg, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.error('❌ 処理件数は正の整数で指定してください');
      console.error('   使用例: npm run update-difficulty 10');
      process.exit(1);
    }
    count = parsed;
  }

  (async () => {
    await main(count);
    process.exit(0); // 成功時も明示的に終了
  })().catch((error) => {
    console.error('スクリプト実行エラー:', error);
    process.exit(1);
  });
}

export { main };
