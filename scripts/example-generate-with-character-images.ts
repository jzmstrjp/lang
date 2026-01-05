import fs from 'fs';
import path from 'path';
import {
  generateProblem,
  generateAndUploadImageAssetWithCharacters,
  generateImagePromptWithCharacters,
} from '@/lib/problem-generator';

/**
 * キャラクター設定画像を使った画像生成のサンプル
 */
async function generateSceneWithCharacterImages() {
  try {
    // 問題データを取得（全問題からランダムに選択）
    const problem = await generateProblem();
    console.log('Generated problem:', {
      englishSentence: problem.englishSentence,
      englishReply: problem.englishReply,
      senderVoice: problem.senderVoice,
      receiverVoice: problem.receiverVoice,
    });

    // キャラクター画像を読み込み
    // タカシ（男性）とアカリ（女性）の画像
    const takashiPath = path.join(process.cwd(), 'images', 'takashi.png');
    const akariPath = path.join(process.cwd(), 'images', 'akari.png');

    const takashiBuffer = fs.readFileSync(takashiPath);
    const akariBuffer = fs.readFileSync(akariPath);

    // 性別に応じて画像の順序を決定
    // API に渡す配列の順序は、男性が先、女性が後
    const characterImages = [takashiBuffer, akariBuffer];

    // 生成されるプロンプトを確認
    const prompt = generateImagePromptWithCharacters(problem);
    console.log('\n--- Generated Prompt ---');
    console.log(prompt);
    console.log('--- End of Prompt ---\n');

    // 画像を生成してR2にアップロード
    // problemIdは適当な値（実際の使用時は適切なIDを使用）
    const problemId = `test-${Date.now()}`;
    console.log('Generating image with character references...');
    const imageUrl = await generateAndUploadImageAssetWithCharacters(
      problem,
      problemId,
      characterImages,
    );

    console.log('Image uploaded successfully!');
    console.log('Image URL:', imageUrl);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// メイン実行
generateSceneWithCharacterImages();
