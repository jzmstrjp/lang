import { generateSpeech, generateSpeechBuffer } from '@/lib/audio-utils';
import { generateImageBuffer } from '@/lib/image-utils';
import { uploadAudioToR2, uploadImageToR2 } from '@/lib/r2-client';
import type { VoiceGender } from '@/config/voice';
import { countWords, type ProblemLength } from '@/config/problem';
import type { VoiceType } from '@prisma/client';
import type { GeneratedProblem } from '@/types/generated-problem';
export type { GeneratedProblem } from '@/types/generated-problem';

export type GenerateRequest = {
  type?: ProblemLength;
  withoutPicture?: boolean;
};

// Prismaの型を利用
/**
 * VoiceTypeをVoiceGenderに変換
 */
function voiceTypeToVoiceGender(voiceType: VoiceType): VoiceGender {
  return voiceType as VoiceGender; // PrismaのVoiceTypeはVoiceGenderのサブセット
}

/**
 * 性別の英語表記を日本語にマッピング
 */
function getGenderInJapanese(voiceType: VoiceType): '男性' | '女性' {
  switch (voiceType) {
    case 'male':
      return '男性';
    case 'female':
      return '女性';
    default:
      return '' as never;
  }
}

/**
 * 問題タイプに応じて適切なファイルからランダムに1件の問題データを取得
 */
async function getRandomProblemFromSeed(type: ProblemLength = 'short'): Promise<GeneratedProblem> {
  const [{ default: problem10 }] = await Promise.all([import('../../problemData/problem10')]);

  const filteredProblems = [...problem10];

  if (filteredProblems.length === 0) {
    throw new Error(
      `No seed problems found for type "${type}" within the configured word count range.`,
    );
  }

  const randomIndex = Math.floor(Math.random() * filteredProblems.length);
  const selectedProblem = filteredProblems[randomIndex];
  const wordCount = countWords(selectedProblem.englishSentence);

  // GeneratedProblem形式に変換
  return {
    wordCount,
    englishSentence: selectedProblem.englishSentence,
    japaneseSentence: selectedProblem.japaneseSentence,
    japaneseReply: selectedProblem.japaneseReply,
    englishReply: selectedProblem.englishReply,
    incorrectOptions: Array.isArray(selectedProblem.incorrectOptions)
      ? selectedProblem.incorrectOptions
      : [],
    senderVoice: selectedProblem.senderVoice,
    senderRole: selectedProblem.senderRole,
    receiverVoice: selectedProblem.receiverVoice,
    receiverRole: selectedProblem.receiverRole,
    place: selectedProblem.place,
    scenePrompt: selectedProblem.scenePrompt || null,
    senderVoiceInstruction: selectedProblem.senderVoiceInstruction ?? null,
    receiverVoiceInstruction: selectedProblem.receiverVoiceInstruction ?? null,
  };
}

/**
 * 問題生成のメイン関数
 */
export async function generateProblem(type: ProblemLength = 'short'): Promise<GeneratedProblem> {
  // 問題タイプに応じて適切なファイルからランダムに1件取得
  return await getRandomProblemFromSeed(type);
}

const senderNameMap: Record<VoiceType, string> = {
  male: 'Alexander',
  female: 'Olivia',
};
const receiverNameMap: Record<VoiceType, string> = {
  male: 'タカシ',
  female: 'アカリ',
};

/**
 * 画像プロンプトを生成
 */
export function generateImagePrompt(problem: GeneratedProblem): string {
  const senderGenderText = getGenderInJapanese(problem.senderVoice);
  const receiverGenderText = getGenderInJapanese(problem.receiverVoice);

  const senderName = senderNameMap[problem.senderVoice];
  const receiverName = receiverNameMap[problem.receiverVoice];

  return `実写風の2コマ漫画を生成すること。
上下に2コマです。
漫画ですが、吹き出し・台詞は描かないこと。写真のみで表現すること。

【コマの高さ】
上下のコマの高さは正確に同じであること。
上下のコマの間に空白は不要です。

【場所】
${problem.place}

【登場人物】
- ${senderName}（${senderGenderText}）・・・${problem.senderRole}。
- ${receiverName}（${receiverGenderText}）・・・${problem.receiverRole}。

【ストーリー】
${problem.scenePrompt ? `- ${problem.scenePrompt}` : ''}
- ${senderName}（${senderGenderText}）と${receiverName}（${receiverGenderText}）が向かい合っている。
- ${senderName}（${senderGenderText}）が、${receiverName}（${receiverGenderText}）に対して「${problem.japaneseSentence}」と言う。それに対し、${receiverName}（${receiverGenderText}）が「${problem.japaneseReply}」と答える。

【1コマ目】
- ${senderName}（${senderGenderText}）が「${problem.japaneseSentence}」と言っている
- ${senderName}（${senderGenderText}）だけを描く。${receiverName}（${receiverGenderText}）はまだ描かない。
- ${senderName}（${senderGenderText}）が右を向いているアングル

【2コマ目】
- ${receiverName}（${receiverGenderText}）が「${problem.japaneseReply}」と返答している
- ${receiverName}（${receiverGenderText}）だけを描く。${senderName}（${senderGenderText}）は描かない。
- ${receiverName}（${receiverGenderText}）が左を向いているアングル

【備考】
- 場所や場面に合わせた表情やジェスチャーを描写すること。
- ${senderName}（${senderGenderText}）と${receiverName}（${receiverGenderText}）は対面しているわけなので、1コマ目と2コマ目の背景は角度が異なるべき。
- 対話しているように見えるように、1コマ目と2コマ目のカメラアングルを変えること。
- 重要: セリフに対して不自然な画像はNG
  - 例1
    - Bad: 「コーヒーをお願いします」というセリフなのに、もう手元にコーヒーがある
    - Good: 「コーヒーをお願いします」というセリフなので、まだ手元にコーヒーがない
  - 例2
    - Bad: 「ATMはどこですか？」というセリフなのに、すでにATMの前に立っている
    - Good: 「ATMはどこですか？」というセリフなので、まだATMの前に立っていない
- 画像を見ただけで【ストーリー】を完全に想起できるように正確に描写すること。
- 漫画だが、吹き出し・台詞は描かないこと。写真のみで表現すること。
- 生成AIっぽくない自然なテイストで描写すること。

## 重要
- 上下のコマの高さは正確に同じであること。

【禁止事項】
- 同じコマに、同じ人物を2回描画してはならない。
`;
}

/**
 * 音声アセットを生成（Base64形式）
 */
export async function generateAudioAssets(problem: GeneratedProblem): Promise<{
  english: string;
  japanese: string;
  englishReply?: string;
}> {
  const audioPromises = [
    generateSpeech(
      problem.englishSentence,
      voiceTypeToVoiceGender(problem.senderVoice),
      problem.senderVoiceInstruction ?? null,
      problem.senderRole,
    ),
    generateSpeech(
      problem.japaneseReply,
      voiceTypeToVoiceGender(problem.receiverVoice),
      problem.receiverVoiceInstruction ?? null,
      problem.receiverRole,
    ),
  ];

  // englishReplyがある場合は英語返答の音声も生成
  if (problem.englishReply) {
    audioPromises.push(
      generateSpeech(
        problem.englishReply,
        voiceTypeToVoiceGender(problem.receiverVoice),
        problem.receiverVoiceInstruction ?? null,
        problem.receiverRole,
      ),
    );
  }

  const audioResults = await Promise.all(audioPromises);

  const result: { english: string; japanese: string; englishReply?: string } = {
    english: audioResults[0],
    japanese: audioResults[1],
  };

  // englishReplyがある場合は結果に含める
  if (problem.englishReply && audioResults[2]) {
    result.englishReply = audioResults[2];
  }

  return result;
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
  englishReply?: string;
}> {
  const audioBufferPromises = [
    generateSpeechBuffer(
      problem.englishSentence,
      voiceTypeToVoiceGender(problem.senderVoice),
      problem.senderVoiceInstruction ?? null,
      problem.senderRole,
    ),
    generateSpeechBuffer(
      problem.japaneseReply,
      voiceTypeToVoiceGender(problem.receiverVoice),
      problem.receiverVoiceInstruction ?? null,
      problem.receiverRole,
    ),
  ];

  // englishReplyがある場合は英語返答の音声も生成
  if (problem.englishReply) {
    audioBufferPromises.push(
      generateSpeechBuffer(
        problem.englishReply,
        voiceTypeToVoiceGender(problem.receiverVoice),
        problem.receiverVoiceInstruction ?? null,
        problem.receiverRole,
      ),
    );
  }

  const audioBuffers = await Promise.all(audioBufferPromises);

  const uploadPromises = [
    uploadAudioToR2(audioBuffers[0], problemId, 'en', voiceTypeToVoiceGender(problem.senderVoice)),
    uploadAudioToR2(
      audioBuffers[1],
      problemId,
      'ja',
      voiceTypeToVoiceGender(problem.receiverVoice),
    ),
  ];

  // englishReplyがある場合は英語返答音声もアップロード
  if (problem.englishReply && audioBuffers[2]) {
    uploadPromises.push(
      uploadAudioToR2(
        audioBuffers[2],
        problemId,
        'en-reply',
        voiceTypeToVoiceGender(problem.receiverVoice),
      ),
    );
  }

  const uploadResults = await Promise.all(uploadPromises);

  const result: { english: string; japanese: string; englishReply?: string } = {
    english: uploadResults[0],
    japanese: uploadResults[1],
  };

  // englishReplyがある場合は結果に含める
  if (problem.englishReply && uploadResults[2]) {
    result.englishReply = uploadResults[2];
  }

  return result;
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
