#!/usr/bin/env tsx

/**
 * 音声URLがnullなProblemsレコードを取得して音声を生成・R2アップロード・DB更新するスクリプト
 */

import { prisma } from '../src/lib/prisma';
import { generateAndUploadAudioAssets } from '../src/lib/problem-generator';
import type { VoiceGender } from '../src/config/voice';
import { warmupMultipleCDNUrls } from '../src/lib/cdn-utils';

async function main(batchSize: number = 10, checkOnly: boolean = false) {
  try {
    if (checkOnly) {
      console.log('🔍 音声URLチェックモードで実行中...');
    } else {
      console.log('🚀 音声URL修復スクリプトを開始します...');
      console.log(`📊 処理件数上限: ${batchSize}件`);
    }

    // 環境変数のチェック（チェックのみモードでは音声生成用環境変数は不要）
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
          OR: [{ audioEnUrl: null }, { audioJaUrl: null }, { audioEnReplyUrl: null }],
        },
      });
      process.stdout.write(totalMissingCount.toString());
      return;
    }

    // audioEnUrl、audioJaUrl、または audioEnReplyUrl が null のレコードを取得
    console.log('📋 音声URLがnullなレコードを検索中...');

    const problemsWithMissingAudio = await prisma.problem.findMany({
      where: {
        OR: [{ audioEnUrl: null }, { audioJaUrl: null }, { audioEnReplyUrl: null }],
      },
      select: {
        id: true,
        englishSentence: true,
        japaneseReply: true,
        englishReply: true,
        senderVoice: true,
        receiverVoice: true,
        audioEnUrl: true,
        audioJaUrl: true,
        audioEnReplyUrl: true,
        audioReady: true,
      },
      take: batchSize,
      orderBy: {
        createdAt: 'desc', // 新しいものから処理
      },
    });

    if (problemsWithMissingAudio.length === 0) {
      console.log('✅ 音声URLがnullなレコードは見つかりませんでした');
      return;
    }

    console.log(`📊 ${problemsWithMissingAudio.length}件のレコードが見つかりました。`);
    console.log('🔄 直列実行で処理を開始します（APIの負荷制御のため）');

    const totalStartTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    // 各レコードを直列実行で処理（APIの負荷制御のため）
    for (const [index, problem] of problemsWithMissingAudio.entries()) {
      const startTime = Date.now();
      try {
        console.log(
          `\n🔄 [${index + 1}/${problemsWithMissingAudio.length}] 処理開始: ${problem.id}`,
        );
        console.log(`   English: "${problem.englishSentence}"`);
        console.log(`   Japanese Reply: "${problem.japaneseReply}"`);
        console.log(`   English Reply: "${problem.englishReply || 'なし'}"`);

        const updateData: {
          audioEnUrl?: string;
          audioJaUrl?: string;
          audioEnReplyUrl?: string | null;
          audioReady?: boolean;
        } = {};

        // 音声が欠けているかチェック
        const needsEnglish = !problem.audioEnUrl;
        const needsJapanese = !problem.audioJaUrl;
        const needsEnglishReply = !problem.audioEnReplyUrl && problem.englishReply;

        if (needsEnglish || needsJapanese) {
          console.log('   🎤 英語・日本語音声を生成中...');

          // 共通ロジックを使用して音声生成・アップロード
          const audioAssets = await generateAndUploadAudioAssets(
            {
              englishSentence: problem.englishSentence,
              japaneseReply: problem.japaneseReply,
              senderVoice: problem.senderVoice,
              receiverVoice: problem.receiverVoice,
              wordCount: 0, // 一時的な値（実際には使用されない）
              japaneseSentence: '', // 一時的な値（実際には使用されない）
              englishReply: problem.englishReply,
              incorrectOptions: [],
              senderRole: '',
              receiverRole: '',
              place: '',
              patternId: null,
            },
            problem.id,
          );

          if (needsEnglish) {
            updateData.audioEnUrl = audioAssets.english;
            console.log(`   ✅ 英語音声アップロード完了: ${audioAssets.english}`);
          }

          if (needsJapanese) {
            updateData.audioJaUrl = audioAssets.japanese;
            console.log(`   ✅ 日本語音声アップロード完了: ${audioAssets.japanese}`);
          }
        }

        // 英語返答の音声生成
        if (needsEnglishReply) {
          console.log('   🎤 英語返答音声を生成中...');

          // 英語返答の音声を個別に生成・アップロード
          const { generateSpeechBuffer } = await import('../src/lib/audio-utils');
          const { uploadAudioToR2 } = await import('../src/lib/r2-client');

          const englishReplyAudioBuffer = await generateSpeechBuffer(
            problem.englishReply!,
            problem.receiverVoice as VoiceGender,
          );

          const englishReplyAudioUrl = await uploadAudioToR2(
            englishReplyAudioBuffer,
            problem.id,
            'en-reply',
            problem.receiverVoice as VoiceGender,
          );

          updateData.audioEnReplyUrl = englishReplyAudioUrl;
          console.log(`   ✅ 英語返答音声アップロード完了: ${englishReplyAudioUrl}`);
        }

        if (!needsEnglish) {
          console.log(`   ✓ 英語音声は既に存在: ${problem.audioEnUrl}`);
        }

        if (!needsJapanese) {
          console.log(`   ✓ 日本語音声は既に存在: ${problem.audioJaUrl}`);
        }

        if (!needsEnglishReply) {
          if (problem.englishReply) {
            console.log(`   ✓ 英語返答音声は既に存在: ${problem.audioEnReplyUrl}`);
          } else {
            console.log(`   ✓ 英語返答なし（englishReplyがnull）`);
          }
        }

        const finalEnglish = updateData.audioEnUrl ?? problem.audioEnUrl;
        const finalJapanese = updateData.audioJaUrl ?? problem.audioJaUrl;
        const finalEnglishReply = updateData.audioEnReplyUrl ?? problem.audioEnReplyUrl;
        const requiresEnglishReply = Boolean(problem.englishReply && problem.englishReply.trim());

        if (finalEnglish && finalJapanese && (!requiresEnglishReply || finalEnglishReply)) {
          updateData.audioReady = true;
        }

        if (!requiresEnglishReply) {
          updateData.audioEnReplyUrl = finalEnglishReply ?? null;
        }

        if (Object.keys(updateData).length > 0) {
          console.log('   💾 データベースを更新中...');

          await prisma.problem.update({
            where: { id: problem.id },
            data: updateData,
          });

          console.log('   ✅ データベース更新完了');

          // CDNウォームアップを実行（更新されたURLのみ）
          const urlsToWarmup = [
            updateData.audioEnUrl,
            updateData.audioJaUrl,
            updateData.audioEnReplyUrl,
          ].filter((url): url is string => Boolean(url) && url !== null);

          if (urlsToWarmup.length > 0) {
            await warmupMultipleCDNUrls(urlsToWarmup);
          }
        }

        successCount++;
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   🎉 レコード ${problem.id} の処理が完了しました！ (${duration}秒)`);
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
        '❌ 音声URL修復スクリプトはエラーで終了しました',
        '💥 ===============================================',
        `📊 処理結果:`,
        `   ✅ 成功: ${successCount}件`,
        `   ❌ エラー: ${errorCount}件`,
        `   📝 合計: ${problemsWithMissingAudio.length}件`,
        `   ⏱️ 合計時間: ${totalDuration}秒 (直列実行)`,
      ];
      failureSummary.forEach((line) => console.error(line));
      throw new Error(`音声URL修復処理で${errorCount}件のエラーが発生しました`);
    }

    const successSummary = [
      '\n🎊 ===============================================',
      '✅ 音声URL修復スクリプトが完了しました！',
      '🎊 ===============================================',
      `📊 処理結果:`,
      `   ✅ 成功: ${successCount}件`,
      `   ❌ エラー: ${errorCount}件`,
      `   📝 合計: ${problemsWithMissingAudio.length}件`,
      `   ⏱️ 合計時間: ${totalDuration}秒 (直列実行)`,
    ];
    successSummary.forEach((line) => console.log(line));
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
      console.error('   使用例: npm run fix-missing-audio 3');
      console.error('   チェックのみ: npx tsx scripts/fix-missing-audio.ts --check-only');
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
