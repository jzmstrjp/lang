#!/usr/bin/env tsx

/**
 * 画像URLがnullなProblemsレコードを取得して画像を生成・R2アップロード・DB更新するスクリプト
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { generateAndUploadImageAsset, type GeneratedProblem } from '../src/lib/problem-generator';
import { warmupMultipleCDNUrls } from '../src/lib/cdn-utils';

function normalizeIncorrectOptions(value: Prisma.JsonValue): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function main(batchSize: number = 10, checkOnly: boolean = false) {
  try {
    if (checkOnly) {
      console.log('🔍 画像URLチェックモードで実行中...');
    } else {
      console.log('🚀 画像URL修復スクリプトを開始します...');
      console.log(`📊 処理件数上限: ${batchSize}件`);
    }

    // 環境変数のチェック（チェックのみモードでは画像生成用環境変数は不要）
    const requiredEnvs = checkOnly
      ? ['DATABASE_URL']
      : [
          'OPENAI_API_KEY',
          'DATABASE_URL',
          'R2_BUCKET_NAME',
          'R2_ACCESS_KEY_ID',
          'R2_SECRET_ACCESS_KEY',
          'NEXT_PUBLIC_R2_PUBLIC_DOMAIN',
        ];
    const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

    if (missingEnvs.length > 0) {
      console.error('❌ 必要な環境変数が設定されていません:');
      missingEnvs.forEach((env) => console.error(`  - ${env}`));
      process.exit(1);
    }

    if (checkOnly) {
      // チェックのみモードの場合は件数を出力して終了
      const totalMissingCount = await prisma.problem.count({
        where: {
          imageUrl: null,
        },
      });
      process.stdout.write(totalMissingCount.toString());
      return;
    }

    // imageUrl が null のレコードを指定件数取得
    console.log('📋 画像URLがnullなレコードを検索中...');

    const problemsWithMissingImage = await prisma.problem.findMany({
      where: {
        imageUrl: null,
      },
      select: {
        id: true,
        wordCount: true,
        englishSentence: true,
        japaneseSentence: true,
        japaneseReply: true,
        englishReply: true,
        incorrectOptions: true,
        senderVoice: true,
        senderRole: true,
        receiverVoice: true,
        receiverRole: true,
        place: true,
        scenePrompt: true,
      },
      take: batchSize,
      orderBy: {
        wordCount: 'asc', // 単語数が少ないものから処理
      },
    });

    if (problemsWithMissingImage.length === 0) {
      console.log('✅ 画像URLがnullなレコードは見つかりませんでした');
      return;
    }

    console.log(`📊 ${problemsWithMissingImage.length}件のレコードが見つかりました。`);
    console.log('🔄 バッチ処理を開始します（画像生成 → 一括DB更新）');

    const totalStartTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    // フェーズ1: すべての画像を生成・アップロード
    console.log('\n📸 フェーズ1: 画像生成・アップロード');
    const updates: Array<{ id: string; imageUrl: string }> = [];

    for (const [index, problem] of problemsWithMissingImage.entries()) {
      const startTime = Date.now();
      try {
        console.log(
          `\n🔄 [${index + 1}/${problemsWithMissingImage.length}] 画像生成中: ${problem.id}`,
        );
        console.log(`   English: "${problem.englishSentence}"`);
        console.log(`   場所: ${problem.place}`);

        // 共通ロジックを使用して画像生成・アップロード
        const generatedProblem: GeneratedProblem = {
          wordCount: problem.wordCount,
          englishSentence: problem.englishSentence,
          japaneseSentence: problem.japaneseSentence,
          japaneseReply: problem.japaneseReply,
          englishReply: problem.englishReply,
          incorrectOptions: normalizeIncorrectOptions(problem.incorrectOptions),
          senderVoice: problem.senderVoice,
          senderRole: problem.senderRole,
          receiverVoice: problem.receiverVoice,
          receiverRole: problem.receiverRole,
          place: problem.place,
          scenePrompt: problem.scenePrompt ?? null,
          patternId: null,
        };

        const imageUrl = await generateAndUploadImageAsset(generatedProblem, problem.id);

        console.log(`   ✅ 画像アップロード完了: ${imageUrl}`);

        // 更新リストに追加
        updates.push({ id: problem.id, imageUrl });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   🎉 画像生成完了 (${duration}秒)`);
      } catch (error) {
        errorCount++;
        console.error(`   ❌ レコード ${problem.id} の画像生成中にエラーが発生:`, error);
        // エラーが発生しても他のレコードの処理を続行
      }
    }

    // フェーズ2: トランザクションで一括DB更新
    if (updates.length > 0) {
      console.log(`\n💾 フェーズ2: データベース一括更新（${updates.length}件）`);
      try {
        await prisma.$transaction(
          updates.map(({ id, imageUrl }) =>
            prisma.problem.update({
              where: { id },
              data: { imageUrl },
            }),
          ),
        );

        console.log(`   ✅ ${updates.length}件のレコードを一括更新しました`);
        successCount = updates.length;

        // フェーズ3: CDNウォームアップ
        console.log('\n🔥 フェーズ3: CDNウォームアップ');
        const imageUrls = updates.map((u) => u.imageUrl);
        await warmupMultipleCDNUrls(imageUrls);
        console.log(`   ✅ ${imageUrls.length}件のURLをウォームアップしました`);
      } catch (error) {
        console.error('   ❌ データベース一括更新中にエラーが発生:', error);
        // DB更新に失敗した場合、画像生成は成功しているのでerrorCountには加算しない
        // ただし、successCountは0のまま
        throw error;
      }
    }

    const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(1);

    console.log('\n🎊 ===============================================');
    if (errorCount > 0) {
      console.log('⚠️ 画像URL修復スクリプトが部分的に完了しました');
    } else {
      console.log('✅ 画像URL修復スクリプトが完了しました！');
    }
    console.log('🎊 ===============================================');
    console.log(`📊 処理結果:`);
    console.log(`   ✅ 成功: ${successCount}件`);
    console.log(`   ❌ エラー: ${errorCount}件`);
    console.log(`   📝 合計: ${problemsWithMissingImage.length}件`);
    console.log(`   ⏱️ 合計時間: ${totalDuration}秒 (バッチ処理)`);

    // 全件エラーの場合は異常終了
    if (errorCount > 0 && successCount === 0) {
      throw new Error(`全ての処理が失敗しました (${errorCount}件のエラー)`);
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
  let batchSize = 10; // デフォルト値
  let checkOnly = false;

  // --check-only フラグの確認
  if (args.includes('--check-only')) {
    checkOnly = true;
    const checkIndex = args.indexOf('--check-only');
    args.splice(checkIndex, 1); // フラグを配列から削除
  }

  // 件数の取得（残った引数の最初）
  const batchSizeArg = args[0];
  if (batchSizeArg) {
    const parsed = parseInt(batchSizeArg, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.error('❌ 処理件数は正の整数で指定してください');
      console.error('   使用例: npm run fix-missing-image 3');
      console.error('   チェックのみ: npx tsx scripts/fix-missing-image.ts --check-only');
      process.exit(1);
    }
    batchSize = parsed;
  }

  (async () => {
    await main(batchSize, checkOnly);
  })().catch((error) => {
    console.error('スクリプト実行エラー:', error);
    process.exit(1);
  });
}

export { main };
