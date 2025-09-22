#!/usr/bin/env tsx

/**
 * route.tsの関数を直接呼び出して問題を生成するスクリプト
 */

import { POST } from '../src/app/api/problem/generate/route';

interface GenerateRequest {
  type?: 'short' | 'medium' | 'long';
  withoutPicture?: boolean;
  skipSave?: boolean;
}

async function main() {
  try {
    console.log('🚀 問題生成を開始します...');

    // 環境変数のチェック
    const requiredEnvs = [
      'OPENAI_API_KEY',
      'DATABASE_URL',
      'R2_BUCKET_NAME',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ];
    const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

    if (missingEnvs.length > 0) {
      console.error('❌ 必要な環境変数が設定されていません:');
      missingEnvs.forEach((env) => console.error(`  - ${env}`));
      process.exit(1);
    }

    // コマンドライン引数から設定を取得
    const args = process.argv.slice(2);
    const type = (args[0] || 'short') as 'short' | 'medium' | 'long';
    const withoutPicture = args[1] === 'true';

    console.log(`📊 Type: ${type}`);
    console.log(`🖼️ Without Picture: ${withoutPicture}`);

    // リクエストオブジェクトを作成
    const requestBody: GenerateRequest = {
      type,
      withoutPicture,
      skipSave: false,
    };

    // モックリクエストオブジェクトを作成
    const mockRequest = {
      json: async () => requestBody,
    } as Request;

    console.log('📝 問題生成中...');

    // route.tsのPOST関数を直接呼び出し
    const response = await POST(mockRequest);
    const result = await response.json();

    if (result.error) {
      console.error('❌ エラーが発生しました:', result.error);
      process.exit(1);
    }

    if (result.problem) {
      console.log('\n🎉 ===============================================');
      console.log('✅ 問題が正常に生成されました！');
      console.log('🎉 ===============================================');
      console.log('📚 English:', result.problem.english);
      console.log('🗾 Japanese Reply:', result.problem.japaneseReply);
      console.log('📊 Type:', result.problem.type);
      console.log('🎭 Genre:', result.problem.genre);
      console.log('💬 Nuance:', result.problem.nuance);
      console.log('📝 Word Count:', result.problem.wordCount);

      console.log('\n📝 選択肢:');
      result.problem.options.forEach((option: string, index: number) => {
        const marker = index === result.problem.correctIndex ? '✅' : '❌';
        console.log(`  ${marker} ${index + 1}. ${option}`);
      });

      console.log('\n💾 データベースに保存されました');
      console.log('🎊 問題生成完了！');
    } else {
      console.log('❌ 問題の生成に失敗しました。');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 問題生成エラー:', error);
    throw error; // エラーを再スローして適切に処理
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
