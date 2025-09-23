import { generateSpeech, generateSpeechBuffer } from '@/lib/audio-utils';
import { generateImageBuffer } from '@/lib/image-utils';
import { uploadAudioToR2, uploadImageToR2 } from '@/lib/r2-client';
import type { VoiceGender } from '@/config/voice';
import type { ProblemLength } from '@/config/problem';

export type GenerateRequest = {
  type?: ProblemLength;
  withoutPicture?: boolean;
};

// Prismaの型を拡張して使用
export type GeneratedProblem = {
  wordCount: number;
  englishSentence: string;
  japaneseSentence: string;
  japaneseReply: string;
  incorrectOptions: string[];
  senderVoice: string;
  senderRole: string;
  receiverVoice: string;
  receiverRole: string;
  place: string;
};

/**
 * 性別の英語表記を日本語にマッピング
 */
function getGenderInJapanese(voiceGender: string): string {
  switch (voiceGender) {
    case 'male':
      return '男性';
    case 'female':
      return '女性';
    case 'neutral':
      return '';
    default:
      return '';
  }
}

/**
 * probrem1.tsからランダムに1件の問題データを取得
 */
async function getRandomProblemFromSeed(): Promise<GeneratedProblem> {
  // probrem1.tsのデータを動的にインポート
  const { default: problems } = await import('../../probremData/probrem1');

  // ランダムに1件選択
  const randomIndex = Math.floor(Math.random() * problems.length);
  const selectedProblem = problems[randomIndex];

  // GeneratedProblem形式に変換
  return {
    wordCount: selectedProblem.englishSentence.split(' ').length,
    englishSentence: selectedProblem.englishSentence,
    japaneseSentence: selectedProblem.japaneseSentence,
    japaneseReply: selectedProblem.japaneseReply,
    incorrectOptions: Array.isArray(selectedProblem.incorrectOptions)
      ? selectedProblem.incorrectOptions
      : [],
    senderVoice: selectedProblem.senderVoice,
    senderRole: selectedProblem.senderRole,
    receiverVoice: selectedProblem.receiverVoice,
    receiverRole: selectedProblem.receiverRole,
    place: selectedProblem.place,
  };
}

/**
 * 問題生成のメイン関数
 */
export async function generateProblem(): Promise<GeneratedProblem> {
  // シンプルに probrem1.ts からランダムに1件取得するだけ
  return await getRandomProblemFromSeed();
}

/**
 * 画像プロンプトを生成
 */
export function generateImagePrompt(problem: GeneratedProblem): string {
  const senderGenderText = `（${getGenderInJapanese(problem.senderVoice)}）`;
  const receiverGenderText = `（${getGenderInJapanese(problem.receiverVoice)}）`;

  return `実写風の2コマ漫画を生成してください。
縦に2コマです。
漫画ですが、吹き出し・台詞は描かないこと。写真のみで表現してください。
上下のコマの高さは完全に同じであること。
上下のコマの間に高さ20ピクセルの白い境界線が必要です。

【場所】
${problem.place}

【登場人物】
${problem.senderRole}${senderGenderText}
${problem.receiverRole}${receiverGenderText}

【ストーリー】
${problem.senderRole}${senderGenderText}が${problem.receiverRole}${receiverGenderText}に対して「${problem.englishSentence}」と言う。それに対し、${problem.receiverRole}${receiverGenderText}が「${problem.japaneseReply}」と答える。

【1コマ目】
- ${problem.place}で${problem.senderRole}${senderGenderText}が「${problem.englishSentence}」と言っている様子を描いてください。
- ${problem.receiverRole}${receiverGenderText}はまだ描かないこと。

【2コマ目】
- ${problem.senderRole}${senderGenderText}の台詞を聞いた${problem.receiverRole}${receiverGenderText}が${problem.place}で「${problem.japaneseReply}」と反応した様子を描いてください。

【備考】
- 場所や場面に合わせた表情やジェスチャーを描写してください。
- 漫画ですが、吹き出し・台詞は描かないこと。写真のみで表現してください。
- 自然で生成AIっぽくないテイストで描写してください。`;
}

/**
 * 音声アセットを生成（Base64形式）
 */
export async function generateAudioAssets(problem: GeneratedProblem): Promise<{
  english: string;
  japanese: string;
}> {
  const [englishAudio, japaneseAudio] = await Promise.all([
    generateSpeech(problem.englishSentence, problem.senderVoice as VoiceGender),
    generateSpeech(problem.japaneseReply, problem.receiverVoice as VoiceGender),
  ]);

  return {
    english: englishAudio,
    japanese: japaneseAudio,
  };
}

/**
 * 音声アセットを生成してR2にアップロード
 */
export async function generateAndUploadAudioAssets(
  problem: GeneratedProblem,
  problemId: string,
): Promise<{
  english: string;
  japanese: string;
}> {
  const [englishAudioBuffer, japaneseAudioBuffer] = await Promise.all([
    generateSpeechBuffer(problem.englishSentence, problem.senderVoice as VoiceGender),
    generateSpeechBuffer(problem.japaneseReply, problem.receiverVoice as VoiceGender),
  ]);

  const [englishAudio, japaneseAudio] = await Promise.all([
    uploadAudioToR2(englishAudioBuffer, problemId, 'en', problem.senderVoice as VoiceGender),
    uploadAudioToR2(japaneseAudioBuffer, problemId, 'ja', problem.receiverVoice as VoiceGender),
  ]);

  return {
    english: englishAudio,
    japanese: japaneseAudio,
  };
}

/**
 * 画像アセットを生成してR2にアップロード
 */
export async function generateAndUploadImageAsset(
  problem: GeneratedProblem,
  problemId: string,
): Promise<string> {
  const imagePrompt = generateImagePrompt(problem);
  const imageBuffer = await generateImageBuffer(imagePrompt);
  return await uploadImageToR2(imageBuffer, problemId, 'composite');
}
