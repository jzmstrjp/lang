import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { generateSpeech, generateSpeechBuffer } from '@/lib/audio-utils';
import { generateImageBuffer, generateImageWithCharactersBuffer } from '@/lib/image-utils';
import { uploadAudioToR2, uploadImageToR2 } from '@/lib/r2-client';
import type { VoiceGender } from '@/config/voice';
import { countWords, WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import type { VoiceType } from '@prisma/client';
import type { GeneratedProblem } from '@/types/generated-problem';
import type { SeedProblemData } from '@/types/problem';
export type { GeneratedProblem } from '@/types/generated-problem';

export type GenerateRequest = {
  type?: ProblemLength;
  withoutPicture?: boolean;
};

let cachedSeedProblems: SeedProblemData[] | null = null;

/**
 * problemData配下の全SeedProblemDataを動的に読み込む
 */
async function loadSeedProblems(): Promise<SeedProblemData[]> {
  if (cachedSeedProblems) {
    return cachedSeedProblems;
  }

  const problemDataDir = path.join(process.cwd(), 'problemData');

  let entries: Dirent[];
  try {
    entries = await readdir(problemDataDir, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`problemDataディレクトリの読み込みに失敗しました: ${message}`);
  }

  const problemFiles = entries
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'),
    )
    .map((entry) => entry.name)
    .sort();

  if (problemFiles.length === 0) {
    cachedSeedProblems = [];
    return cachedSeedProblems;
  }

  const problemModuleArrays = await Promise.all(
    problemFiles.map(async (file) => {
      const moduleData = (await import(`../../problemData/${file.replace(/\.ts$/, '')}`)) as {
        default?: SeedProblemData[];
      };
      return moduleData.default ?? [];
    }),
  );

  cachedSeedProblems = problemModuleArrays.flat();
  return cachedSeedProblems;
}

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
async function getRandomProblemFromSeed(type?: ProblemLength): Promise<GeneratedProblem> {
  const seedProblems = await loadSeedProblems();
  const filteredProblems = type
    ? seedProblems.filter((p) => {
        const wordCount = countWords(p.englishSentence);
        const rule = WORD_COUNT_RULES[type];
        return wordCount >= rule.min && wordCount <= rule.max;
      })
    : seedProblems;

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
    difficultyLevel: null,
  };
}

/**
 * 問題生成のメイン関数
 */
export async function generateProblem(type?: ProblemLength): Promise<GeneratedProblem> {
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

const senderFaceDirectionMap = [
  // ['真正面', '真正面'],
  ['右側', '左側'],
  ['左側', '右側'],
];

/**
 * 画像プロンプトを生成
 */
export function generateImagePrompt(problem: GeneratedProblem): string {
  const senderGenderText = getGenderInJapanese(problem.senderVoice);
  const receiverGenderText = getGenderInJapanese(problem.receiverVoice);

  const senderName = senderNameMap[problem.senderVoice];
  const receiverName = receiverNameMap[problem.receiverVoice];

  const [senderFaceDirection, receiverFaceDirection] =
    senderFaceDirectionMap[Math.floor(Math.random() * senderFaceDirectionMap.length)];

  return `上下2コマに分割された写真を生成すること。
上下のコマの高さは正確に同じであること。

【重要】
- 1コマ目、2コマ目を通して、それぞれの人物の服装や髪型は変わらないこと。

【コマの高さ】
上下のコマの高さは正確に同じであること。
上下のコマの間に空白は不要です。

【場所】
${problem.place}

【登場人物】
- 話しかける人（sender）
  - ${senderName}（${senderGenderText}）・・・${problem.senderRole}。
- 話しかけられて応答する人（receiver）
  - ${receiverName}（${receiverGenderText}）・・・${problem.receiverRole}。

※ビデオ通話の場合は、必ず登場人物たちにイヤフォンなどを着用させてください。通常の電話であれば不要です。

【ストーリー】
${problem.scenePrompt ? `- ${problem.scenePrompt}` : ''}
これを2コマに分けて描いてください。

【1コマ目】
- ${senderName}（${senderGenderText}）は画像の${receiverFaceDirection}にいて、${senderFaceDirection}を向いて「${problem.englishSentence}」と言っている。
- ただし、吹き出しや台詞や字幕は描かないこと。写真だけで表現すること。
- まだ${receiverName}（${receiverGenderText}）は描かないこと。

【2コマ目】
- ${receiverName}（${receiverGenderText}）は画像の${senderFaceDirection}にいて、${receiverFaceDirection}を向いて「${problem.englishReply}」と返答している。つまり1コマ目とは左右逆のアングルで描画すること。
- ただし、吹き出しや台詞や字幕は描かないこと。写真だけで表現すること。
- もう${senderName}（${senderGenderText}）は描かないこと。

【備考】
- 場所や場面に合わせた表情やジェスチャーを描写すること。
- 1コマ目、2コマ目が同じ場所だとしても、背景のアングルは変えるべきです。
- 1コマ目、2コマ目を通して、それぞれの人物の服装や髪型は変わらないこと。
- 重要: セリフに対して不自然な画像はNG
  - 例1
    - Bad: 「コーヒーをお願いします」というセリフなのに、もう手元にコーヒーがある
    - Good: 「コーヒーをお願いします」というセリフなので、まだ手元にコーヒーがない
  - 例2
    - Bad: 「ATMはどこですか？」というセリフなのに、すでにATMの前に立っている
    - Good: 「ATMはどこですか？」というセリフなので、まだATMの前に立っていない
- 画像を見ただけで【ストーリー】を完全に想起できるように正確に描写すること。
- 生成AIっぽくない、自然な本物の写真を生成すること。

## 重要
- 上下のコマの高さは正確に同じであること。

【禁止事項】
- 1つのコマの中に同じ人物を2回描画してはならない。
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
      'en',
      problem.senderVoiceInstruction ?? null,
      problem.senderRole,
    ),
    generateSpeech(
      problem.japaneseReply,
      voiceTypeToVoiceGender(problem.receiverVoice),
      'ja',
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
        'en',
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
      'en',
      problem.senderVoiceInstruction ?? null,
      problem.senderRole,
    ),
    generateSpeechBuffer(
      problem.japaneseReply,
      voiceTypeToVoiceGender(problem.receiverVoice),
      'ja',
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
        'en',
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

/**
 * キャラクター設定画像を使って画像アセットを生成してR2にアップロード
 */
export async function generateAndUploadImageAssetWithCharacters(
  problem: GeneratedProblem,
  problemId: string,
  characterImages: Buffer[],
): Promise<string> {
  const imagePrompt = generateImagePromptWithCharacters(problem);
  const imageBuffer = await generateImageWithCharactersBuffer(characterImages, imagePrompt);
  return await uploadImageToR2(imageBuffer, problemId, 'composite');
}

/**
 * 動物キャラクター用の画像アセットを生成してR2にアップロード
 */
export async function generateAndUploadImageAssetWithAnimals(
  problem: GeneratedProblem,
  problemId: string,
  animalImages: Buffer[],
): Promise<string> {
  const imagePrompt = generateImagePromptWithAnimals(problem);
  const imageBuffer = await generateImageWithCharactersBuffer(animalImages, imagePrompt);
  return await uploadImageToR2(imageBuffer, problemId, 'composite');
}

/**
 * キャラクター設定画像を使った画像生成用のプロンプトを生成
 */
export function generateImagePromptWithCharacters(problem: GeneratedProblem): string {
  const senderGenderText = getGenderInJapanese(problem.senderVoice);
  const receiverGenderText = getGenderInJapanese(problem.receiverVoice);

  // キャラクター画像を使う場合は male=タカシ、female=アカリ で統一
  const senderName = problem.senderVoice === 'male' ? 'タカシ（42歳）' : 'アカリ（20歳）';
  const receiverName = problem.receiverVoice === 'male' ? 'タカシ（42歳）' : 'アカリ（20歳）';

  const [senderFaceDirection, receiverFaceDirection] =
    senderFaceDirectionMap[Math.floor(Math.random() * senderFaceDirectionMap.length)];

  // 画像の対応関係は常に固定（1枚目=タカシ(male)、2枚目=アカリ(female)）
  const imageMapping = `入力画像の対応は次の通りです。
- 1枚目の画像は「タカシ（男性・42歳・身長173cm）」です。
- 2枚目の画像は「アカリ（女性・20歳・身長140cm）」です。`;

  return `${imageMapping}

両者の「顔立ち・髪型・目の形・肌の色・服の配色・全体の絵柄」を、それぞれの画像の設定に忠実に維持してください。
新しいキャラクターに変形したり、別人化したりしないでください。

【生成したいシーン】
上下2コマに分割された荘厳な油絵を生成すること。
上下のコマの高さは正確に同じであること。

【重要】
- 1コマ目、2コマ目を通して、それぞれの人物の服装や髪型は変わらないこと。

【コマの高さ】
上下のコマの高さは正確に同じであること。
上下のコマの間に空白は不要です。
枠線も不要です。

【場所】
${problem.place}

【登場人物】
- ${senderName}（${senderGenderText}）・・・${problem.senderRole}。
- ${receiverName}（${receiverGenderText}）・・・${problem.receiverRole}。

※ビデオ通話の場合は、必ず登場人物たちにイヤフォンなどを着用させてください。通常の電話であれば不要です。

【ストーリー】
${problem.scenePrompt ? `- ${problem.scenePrompt}` : ''}
これを2コマに分けて描いてください。

【1コマ目】
- ${senderName}（${senderGenderText}）が${senderFaceDirection}に向かって「${problem.englishSentence}」と言っている。
- ただし、吹き出しは不要です。台詞も不要です。枠線も不要です。字幕も不要です。油絵だけで表現してください。
- まだ${receiverName}（${receiverGenderText}）は描かないこと。

【2コマ目】
- ${receiverName}（${receiverGenderText}）が${receiverFaceDirection}に向かって「${problem.englishReply}」と返答している。1コマ目とは左右逆のアングルで描画すること。
- ただし、吹き出しは不要です。台詞も不要です。枠線も不要です。字幕も不要です。油絵だけで表現してください。
- もう${senderName}（${senderGenderText}）は描かないこと。

【備考】
- 場所や場面に合わせた表情やジェスチャーを描写すること。
- 1コマ目、2コマ目を通して、それぞれの人物の服装や髪型は変わらないこと。
- 重要: セリフに対して不自然な画像はNG
  - 例1
    - Bad: 「コーヒーをお願いします」というセリフなのに、もう手元にコーヒーがある
    - Good: 「コーヒーをお願いします」というセリフなので、まだ手元にコーヒーがない
  - 例2
    - Bad: 「ATMはどこですか？」というセリフなのに、すでにATMの前に立っている
    - Good: 「ATMはどこですか？」というセリフなので、まだATMの前に立っていない
- 画像を見ただけで【ストーリー】を完全に想起できるように正確に描写すること。
- 生成AIっぽくない、自然な本物の油絵を生成すること。

## 重要
- 上下のコマの高さは正確に同じであること。
- 入力されたキャラクター画像の特徴を忠実に再現すること。

【禁止事項】
- 1つのコマの中に同じ人物を2回描画してはならない。
- キャラクター画像と異なる顔や服装にしてはならない。
- ビデオ通話のシーンの場合は、必ず登場人物たちにイヤフォンなどを着用させてください。通常の電話であれば不要です。
`;
}

/**
 * 動物キャラクター用の画像プロンプトを生成
 */
export function generateImagePromptWithAnimals(problem: GeneratedProblem): string {
  // 動物の種類を性別で決定（male=黒猫、female=白猫）
  const senderAnimal = problem.senderVoice === 'male' ? '黒猫' : '白猫';
  const receiverAnimal = problem.receiverVoice === 'male' ? '黒猫' : '白猫';

  const senderName = problem.senderVoice === 'male' ? 'ブラック' : 'ホワイト';
  const receiverName = problem.receiverVoice === 'male' ? 'クロ' : 'シロ';

  const [senderFaceDirection, receiverFaceDirection] =
    senderFaceDirectionMap[Math.floor(Math.random() * senderFaceDirectionMap.length)];

  return `入力画像として参考画像が提供されています。
この画像の画風・絵柄・タッチを完全に模倣してください。

上下に分割された画像を生成すること。枠線は無し。
上下の画像の高さは正確に同じであること。

【重要】
- 入力画像と同じ画風・絵柄で描くこと。完全に模倣すること。表情はストーリーに合わせて変えてください。
- 枠線を書くことは禁止する。
- 登場人物はすべて猫です。
- 上下の画像を通して、それぞれの猫の特徴（毛色、模様、体型）は変わらないこと。

【上下の画像の高さ】
上下の画像の高さは正確に同じであること。
上下の画像の間に空白はゼロ。
周りの余白もゼロ。枠線は禁止。

【場所】
${problem.place}

【登場キャラクター】
- 話しかける猫（sender）
  - ${senderName}（${senderAnimal}）・・・${problem.senderRole}として行動する猫。
- 話しかけられて応答する猫（receiver）
  - ${receiverName}（${receiverAnimal}）・・・${problem.receiverRole}として行動する猫。

【ストーリー】
${problem.scenePrompt ? `- ${problem.scenePrompt}` : ''}
これを前半後半として上下に分割して描いてください。

【上半分の画像】
- ${senderName}（${senderAnimal}）は画像の${receiverFaceDirection}にいて、${senderFaceDirection}を向いて「${problem.englishSentence}」と言っている。
- ただし、吹き出しや台詞や字幕は描かないこと。絵だけで表現すること。枠線は書くな。
- まだ${receiverName}（${receiverAnimal}）は描かないこと。

【下半分の画像】
- ${receiverName}（${receiverAnimal}）は画像の${senderFaceDirection}にいて、${receiverFaceDirection}を向いて「${problem.englishReply}」と返答している。つまり上の画像とは左右逆のアングルで描画すること。
- ただし、吹き出しや台詞や字幕は描かないこと。絵だけで表現すること。枠線は書くな。
- もう${senderName}（${senderAnimal}）は描かないこと。

【備考】
- 入力画像と同じ画風で描くこと。完全に模倣すること。表情はストーリーに合わせて変えてください。
- 場所や場面に合わせた表情やジェスチャーを描写すること。
- 動きのあるシーンは、残像を用いて大袈裟なほど動きを描写すること。
- 上下の画像が同じ場所だとしても、背景のアングルは変えること。
- 上下の画像を通して、それぞれの猫の特徴（毛色、模様、体型）は変わらないこと。

## 重要
- 上下の画像の高さは正確に同じであること。
- 上下の画像の間に空白はゼロ。
- 周りの余白もゼロ。
- 枠線も無し。

【禁止事項】
- 1つの画像の中に同じ猫を2回描画してはならない。
- 人間を描いてはならない（すべて猫です）。
- 枠線は無し。
`;
}
