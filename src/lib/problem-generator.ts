import { generateSpeech, generateSpeechBuffer } from '@/lib/audio-utils';
import { generateImageBuffer } from '@/lib/image-utils';
import { uploadAudioToR2, uploadImageToR2 } from '@/lib/r2-client';
import type { VoiceGender } from '@/config/voice';
import type { ProblemLength } from '@/config/problem';
import type { Problem, VoiceType } from '@prisma/client';

export type GenerateRequest = {
  type?: ProblemLength;
  withoutPicture?: boolean;
};

// Prismaの型を利用
export type GeneratedProblem = Omit<
  Problem,
  'id' | 'audioEnUrl' | 'audioJaUrl' | 'imageUrl' | 'createdAt' | 'updatedAt' | 'incorrectOptions'
> & {
  incorrectOptions: string[];
};

/**
 * VoiceTypeをVoiceGenderに変換
 */
function voiceTypeToVoiceGender(voiceType: VoiceType): VoiceGender {
  return voiceType as VoiceGender; // PrismaのVoiceTypeはVoiceGenderのサブセット
}

/**
 * 性別の英語表記を日本語にマッピング
 */
function getGenderInJapanese(voiceType: VoiceType): string {
  switch (voiceType) {
    case 'male':
      return '男性';
    case 'female':
      return '女性';
    default:
      return '';
  }
}

/**
 * 問題タイプに応じて適切なファイルからランダムに1件の問題データを取得
 */
async function getRandomProblemFromSeed(type: ProblemLength = 'short'): Promise<GeneratedProblem> {
  // 問題タイプに応じてファイルを選択
  let problems;
  if (type === 'long') {
    // 長文の場合はprobrem2.tsから取得
    const { default: longProblems } = await import('../../probremData/probrem2');
    problems = longProblems;
  } else {
    // 短文・中文の場合はprobrem1.tsから取得
    const { default: shortMediumProblems } = await import('../../probremData/probrem1');
    problems = shortMediumProblems;
  }

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
export async function generateProblem(type: ProblemLength = 'short'): Promise<GeneratedProblem> {
  // 問題タイプに応じて適切なファイルからランダムに1件取得
  return await getRandomProblemFromSeed(type);
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
    generateSpeech(problem.englishSentence, voiceTypeToVoiceGender(problem.senderVoice)),
    generateSpeech(problem.japaneseReply, voiceTypeToVoiceGender(problem.receiverVoice)),
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
    generateSpeechBuffer(problem.englishSentence, voiceTypeToVoiceGender(problem.senderVoice)),
    generateSpeechBuffer(problem.japaneseReply, voiceTypeToVoiceGender(problem.receiverVoice)),
  ]);

  const [englishAudio, japaneseAudio] = await Promise.all([
    uploadAudioToR2(
      englishAudioBuffer,
      problemId,
      'en',
      voiceTypeToVoiceGender(problem.senderVoice),
    ),
    uploadAudioToR2(
      japaneseAudioBuffer,
      problemId,
      'ja',
      voiceTypeToVoiceGender(problem.receiverVoice),
    ),
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
