#!/usr/bin/env tsx

/**
 * 音声URLがnullなProblemsレコードを取得して音声を生成・R2アップロード・DB更新するスクリプト
 */

import { prisma } from '../src/lib/prisma';
import { generateSpeechBuffer } from '../src/lib/audio-utils';
import { uploadAudioToR2 } from '../src/lib/r2-client';
import type { VoiceGender } from '../src/config/voice';

async function main() {
  try {
    console.log('🚀 音声URL修復スクリプトを開始します...');

    // 環境変数のチェック
    const requiredEnvs = [
      'OPENAI_API_KEY',
      'DATABASE_URL',
      'R2_BUCKET_NAME',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_PUBLIC_DOMAIN',
    ];
    const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

    if (missingEnvs.length > 0) {
      console.error('❌ 必要な環境変数が設定されていません:');
      missingEnvs.forEach((env) => console.error(`  - ${env}`));
      process.exit(1);
    }

    // audioEnUrl または audioJaUrl が null のレコードを10件取得
    console.log('📋 音声URLがnullなレコードを検索中...');

    const problemsWithMissingAudio = await prisma.problem.findMany({
      where: {
        OR: [{ audioEnUrl: null }, { audioJaUrl: null }],
      },
      select: {
        id: true,
        englishSentence: true,
        japaneseReply: true,
        senderVoice: true,
        receiverVoice: true,
        audioEnUrl: true,
        audioJaUrl: true,
      },
      take: 10,
      orderBy: {
        createdAt: 'desc', // 新しいものから処理
      },
    });

    if (problemsWithMissingAudio.length === 0) {
      console.log('✅ 音声URLがnullなレコードは見つかりませんでした。');
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

        const updateData: { audioEnUrl?: string; audioJaUrl?: string } = {};

        // 英語音声が欠けている場合（直列実行）
        if (!problem.audioEnUrl) {
          console.log('   🎤 [1/2] 英語音声を生成中...');

          const englishAudioBuffer = await generateSpeechBuffer(
            problem.englishSentence,
            problem.senderVoice as VoiceGender,
          );

          const englishAudioUrl = await uploadAudioToR2(
            englishAudioBuffer,
            problem.id,
            'en',
            problem.senderVoice as VoiceGender,
          );

          updateData.audioEnUrl = englishAudioUrl;
          console.log(`   ✅ 英語音声アップロード完了: ${englishAudioUrl}`);
        } else {
          console.log(`   ✓ 英語音声は既に存在: ${problem.audioEnUrl}`);
        }

        // 日本語音声が欠けている場合（直列実行）
        if (!problem.audioJaUrl) {
          console.log('   🎤 [2/2] 日本語音声を生成中...');

          const japaneseAudioBuffer = await generateSpeechBuffer(
            problem.japaneseReply,
            problem.receiverVoice as VoiceGender,
          );

          const japaneseAudioUrl = await uploadAudioToR2(
            japaneseAudioBuffer,
            problem.id,
            'ja',
            problem.receiverVoice as VoiceGender,
          );

          updateData.audioJaUrl = japaneseAudioUrl;
          console.log(`   ✅ 日本語音声アップロード完了: ${japaneseAudioUrl}`);
        } else {
          console.log(`   ✓ 日本語音声は既に存在: ${problem.audioJaUrl}`);
        }

        // DBを更新（何らかの音声URLが生成された場合のみ）
        if (Object.keys(updateData).length > 0) {
          console.log('   💾 データベースを更新中...');

          await prisma.problem.update({
            where: { id: problem.id },
            data: updateData,
          });

          console.log('   ✅ データベース更新完了');
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

    console.log('\n🎊 ===============================================');
    console.log('✅ 音声URL修復スクリプトが完了しました！');
    console.log('🎊 ===============================================');
    console.log(`📊 処理結果:`);
    console.log(`   ✅ 成功: ${successCount}件`);
    console.log(`   ❌ エラー: ${errorCount}件`);
    console.log(`   📝 合計: ${problemsWithMissingAudio.length}件`);
    console.log(`   ⏱️ 合計時間: ${totalDuration}秒 (直列実行)`);
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
  (async () => {
    await main();
  })().catch((error) => {
    console.error('スクリプト実行エラー:', error);
    process.exit(1);
  });
}

export { main };
