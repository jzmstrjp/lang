#!/usr/bin/env tsx

/**
 * 10語以下かつdifficultyLevelがnullなProblemsレコードを取得して
 * レベル1の基準に合致するか判定し、合致する場合はdifficultyLevelを1に更新するスクリプト
 */

import { prisma } from '../src/lib/prisma';
import { OpenAI } from 'openai';
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
 * レベル1の定義
 */
const LEVEL_ONE_DEFINITION = `# 英語問題 レベル1の定義

- ビジネス用語が使用されておらず、小学生でも理解できそうなもの`;

/**
 * OpenAI APIでレベル1の基準に合致するか判定
 */
async function isLevelOne(englishSentence: string, place: string): Promise<boolean> {
  const prompt = `${LEVEL_ONE_DEFINITION}

## 判定依頼

以下の問題が上記の「レベル1の定義」に合致するか判定してください。

**英文**: "${englishSentence}"
**場所**: "${place}"

**出力形式**: 必ずJSON形式で以下のように返してください。
\`\`\`json
{
  "isMatch": true または false
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

    logTokenUsage(response.usage, 'レベル1判定');

    // JSONブロックを抽出
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : content;

    const result = JSON.parse(jsonText.trim());

    // バリデーション
    if (typeof result.isMatch !== 'boolean') {
      throw new Error(`無効な判定結果: ${result.isMatch}（true/falseが必要）`);
    }

    return result.isMatch;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`GPT API呼び出しエラー: ${error.message}`);
    }
    throw error;
  }
}

async function main(count: number = 1) {
  try {
    console.log('🚀 難易度レベル1判定スクリプトを開始します...');
    console.log(`📊 処理件数: 最大${count}件\n`);

    // 環境変数のチェック
    const requiredEnvs = ['OPENAI_API_KEY', 'DATABASE_URL'];
    const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

    if (missingEnvs.length > 0) {
      console.error('❌ 必要な環境変数が設定されていません:');
      missingEnvs.forEach((env) => console.error(`  - ${env}`));
      process.exit(1);
    }

    // 10語以下かつdifficultyLevelがnullのレコードを取得
    console.log('📋 10語以下かつdifficultyLevelがnullなレコードを検索中...');

    const problemsWithoutDifficulty = await prisma.problem.findMany({
      where: {
        difficultyLevel: null,
        wordCount: {
          lte: 10,
        },
      },
      select: {
        id: true,
        englishSentence: true,
        place: true,
      },
      take: count,
      orderBy: {
        createdAt: 'desc', // 新しいものから処理
      },
    });

    if (problemsWithoutDifficulty.length === 0) {
      console.log('✅ 10語以下かつdifficultyLevelがnullなレコードは見つかりませんでした');
      return;
    }

    console.log(`📊 ${problemsWithoutDifficulty.length}件のレコードが見つかりました。`);
    console.log('🔄 処理を開始します...\n');

    const totalStartTime = Date.now();
    let level1Count = 0;
    let level5Count = 0;
    let errorCount = 0;

    // 各レコードを処理
    for (const [index, problem] of problemsWithoutDifficulty.entries()) {
      const startTime = Date.now();
      try {
        console.log(
          `\n🔄 [${index + 1}/${problemsWithoutDifficulty.length}] 処理開始: ${problem.id}`,
        );
        console.log(`   英文: "${problem.englishSentence}"`);
        console.log(`   場所: "${problem.place}"`);

        // OpenAI APIでレベル1に合致するか判定
        console.log('   🤖 レベル1の基準に合致するか判定中...');
        const isMatch = await isLevelOne(problem.englishSentence, problem.place ?? '');

        console.log(`   📈 判定結果: ${isMatch ? '✅ レベル1に合致' : '❌ レベル1に非該当'}`);

        // データベースを更新
        const newLevel = isMatch ? 1 : 5;
        console.log(`   💾 difficultyLevelを${newLevel}に更新中...`);
        await prisma.problem.update({
          where: { id: problem.id },
          data: { difficultyLevel: newLevel },
        });

        console.log('   ✅ データベース更新完了');
        if (isMatch) {
          level1Count++;
        } else {
          level5Count++;
        }

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
        `   ✅ レベル1: ${level1Count}件`,
        `   📊 レベル5: ${level5Count}件（レベル1に非該当）`,
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
        `   ✅ レベル1: ${level1Count}件`,
        `   📊 レベル5: ${level5Count}件（レベル1に非該当）`,
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
      console.error(
        '   ※10語以下かつdifficultyLevelがnullな問題を対象に、レベル1の基準に合致するか判定します',
      );
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
