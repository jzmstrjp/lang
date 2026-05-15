import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import {
  generateSpeech,
  generateSpeechBuffer,
  buildSenderVoiceInstruction,
  buildReceiverVoiceInstruction,
} from '@/lib/audio-utils';
import { generateImageBuffer, generateImageWithCharactersBuffer } from '@/lib/image-utils';
import { uploadAudioToR2, uploadImageToR2 } from '@/lib/r2-client';
import type { VoiceGender } from '@/config/voice';
import {
  countWords,
  WORD_COUNT_RULES,
  DIFFICULTY_LEVEL_RULES,
  type ProblemLength,
} from '@/config/problem';
import type { VoiceType } from '@prisma/client';
import type { GeneratedProblem } from '@/types/generated-problem';
import type { SeedProblemData } from '@/types/problem';
import { buildSceneText } from '@/lib/scene-utils';
import { hasThirdPerson, buildThirdPersonNote } from '@/lib/english-sentence-prompt';
import { TEXT_MODEL } from '@/const';
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
    .toSorted();

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
 * englishReply 生成用プロンプトを組み立てる。
 * create-problems3.ts スクリプトと regenerate-reply API の両方で共有する。
 */
export type EnglishReplyPromptParams = {
  senderName: string;
  receiverName: string;
  who: string;
  whom: string;
  senderGender: '男性' | '女性';
  receiverGender: '男性' | '女性';
  englishSentence: string;
  when: string;
  where: string;
  receiverPlace: string;
  why: string;
  how: string;
};

export function buildEnglishReplyPrompt({
  senderName,
  receiverName,
  who,
  whom,
  senderGender,
  receiverGender,
  englishSentence,
  when,
  where,
  receiverPlace,
  why,
  how,
}: EnglishReplyPromptParams): string {
  return `あなたは${receiverName}（${whom}・${receiverGender}）です。英語ネイティブです。
${senderName}（${who}・${senderGender}）から${how}で「${englishSentence}」と話しかけられました。
この時にあなたが返すであろう、ごく自然な返答のセリフを英語で作成してください。
汎用的な返答でなく、この場面ならではの返答を作成してください。
簡潔な内容で、10語以内を目安に作成してください。
英文法は正確に、文法の間違いがないようにしてください。

【シーン】
- ${senderName}（${who}・${senderGender}）が話しかけたタイミング: ${when}
- ${senderName}（${who}・${senderGender}）がいる場所: ${where}
- ${receiverName}（${whom}・${receiverGender}）がいる場所: ${receiverPlace}

このシーンであなたが返すであろう、ごく自然な返答のセリフを英語で作成してください。

【参考情報】
${receiverName}（${whom}・${receiverGender}）は知らないかもしれない情報です。
- ${senderName}（${who}・${senderGender}）が話しかけようと思ったきっかけ: ${why}
`;
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
async function getRandomProblemFromSeed(
  type?: ProblemLength,
  excludeSentences?: string[],
): Promise<GeneratedProblem> {
  const seedProblems = await loadSeedProblems();
  const isKids = type === 'kids';
  const kidsLevelRange = DIFFICULTY_LEVEL_RULES.kids;
  const excludeSet = new Set(excludeSentences ?? []);

  const filteredProblems = type
    ? isKids
      ? seedProblems.filter(
          (p) =>
            p.difficultyLevel != null &&
            p.difficultyLevel >= kidsLevelRange.min &&
            p.difficultyLevel <= kidsLevelRange.max,
        )
      : seedProblems.filter((p) => {
          if (
            p.difficultyLevel != null &&
            p.difficultyLevel >= kidsLevelRange.min &&
            p.difficultyLevel <= kidsLevelRange.max
          ) {
            return false;
          }
          const wordCount = countWords(p.englishSentence);
          const rule = WORD_COUNT_RULES[type];
          return wordCount >= rule.min && wordCount <= rule.max;
        })
    : seedProblems;

  const unseenProblems =
    excludeSet.size > 0
      ? filteredProblems.filter((p) => !excludeSet.has(p.englishSentence))
      : filteredProblems;

  const candidates = unseenProblems.length > 0 ? unseenProblems : filteredProblems;

  if (candidates.length === 0) {
    throw new Error(
      `No seed problems found for type "${type}" within the configured word count range.`,
    );
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selectedProblem = candidates[randomIndex];
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
    senderName:
      selectedProblem.senderName ?? (selectedProblem.senderVoice === 'male' ? 'タカシ' : 'アカリ'),
    senderRole: selectedProblem.senderRole,
    receiverVoice: selectedProblem.receiverVoice,
    receiverName:
      selectedProblem.receiverName ??
      (selectedProblem.receiverVoice === 'male' ? 'タカシ' : 'アカリ'),
    receiverRole: selectedProblem.receiverRole,
    place: selectedProblem.place,
    how: selectedProblem.how ?? '',
    senderWhen: selectedProblem.senderWhen ?? '',
    receiverPlace: selectedProblem.receiverPlace ?? '',
    senderWhy: selectedProblem.senderWhy ?? '',
    senderWant: selectedProblem.senderWant ?? '',
    difficultyLevel: null,
    expression: selectedProblem.expression ?? '',
    expressionJa: selectedProblem.expressionJa ?? '',
  };
}

/**
 * 問題生成のメイン関数
 */
export async function generateProblem(
  type?: ProblemLength,
  excludeSentences?: string[],
): Promise<GeneratedProblem> {
  // 問題タイプに応じて適切なファイルからランダムに1件取得
  return await getRandomProblemFromSeed(type, excludeSentences);
}

const senderFaceDirectionMap = [
  // ['真正面', '真正面'],
  ['右側', '左側'],
  ['左側', '右側'],
];

type FrameRestrictions = {
  frame1Not: string;
  frame1Must: string;
  frame2Not: string;
  frame2Must: string;
};

/**
 * 各コマで描くべきでない内容をAIで生成
 */
export async function generateFrameRestrictions(
  problem: GeneratedProblem,
): Promise<FrameRestrictions> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const thirdPersonNote =
    hasThirdPerson(problem.englishSentence) || hasThirdPerson(problem.englishReply)
      ? `${buildThirdPersonNote(problem.senderName, problem.receiverName)}\n`
      : '';
  const prompt = `
${thirdPersonNote}
AIによる画像生成では、以下の問題が起こりがちである。
- 「コーヒーをお願いします」というシーンなのに、既にテーブルに置かれたコーヒーが描かれてしまう（まだ注文したばかりなので、コーヒーは描かれるべきではない）
- 「昨日、車を洗ったんだ」というシーンなのに、バケツや雑巾を持っている様子が描かれてしまう（洗車は昨日したことなので、バケツや雑巾は描かれるべきではない）

これらの問題を解決するために「描くべきこと」と「描くべきではないこと」を説明した文章を作成してください。

## 対象シーン
- 場所: ${problem.place}
- 1コマ目: ${problem.senderName}（${problem.senderRole}・${getGenderInJapanese(problem.senderVoice)}）が「${problem.englishSentence}」と話しかけている場面
- 2コマ目: ${problem.receiverName}（${problem.receiverRole}・${getGenderInJapanese(problem.receiverVoice)}）が「${problem.englishReply}」と返答している場面
- シーン情報: ${buildSceneText(problem)}

## 例1
- 場所: スーパーの近くの道
- 1コマ目: タカシ（夫・男性）が「Did you buy bananas today?」と話しかけている場面
- 2コマ目: アカリ（妻・女性）が「Yes, I picked some up earlier this afternoon.」と返答している場面
- シーン情報: 電話での会話。タカシは仕事帰りにスーパーの近くにいる。アカリはすでに午後にバナナを買っている。

\`\`\`json
{
  "frame1Not": "タカシ（夫・男性）がバナナを持っている様子は描かない。",
  "frame1Must": "奥の方に見えるスーパーを描く。",
  "frame2Not": "アカリ（妻・女性）が今まさにスーパーでバナナを買っている様子は描かない。",
  "frame2Must": "近くに置いてあるバナナを描く。"
}
\`\`\`

## 例2
- 場所: 自分のオフィスのデスク
- 1コマ目: アレクサンダー（プロジェクトマネージャー・男性）が「Hi Sarah, I'm calling to ask if you could help me look for the document I left in the conference room after yesterday's meeting.」と話しかけている場面
- 2コマ目: サラ（同じプロジェクトのメンバー・女性）が「Sure, I'll check the conference room right now.」と返答している場面
- シーン情報: 電話での会話。アレクサンダーは昨日の会議後に置き忘れた書類を探している。

\`\`\`json
{
  "frame1Not": "アレクサンダー（プロジェクトマネージャー・男性）は書類を持っていない。",
  "frame1Must": "自分のデスクで電話しているアレクサンダー（プロジェクトマネージャー・男性）を描く。",
  "frame2Not": "アレクサンダー（プロジェクトマネージャー・男性）はまだ会議室にはいない。書類も持っていない。",
  "frame2Must": "電話しているサラ（同じプロジェクトのメンバー・女性）を描く。"
}
\`\`\`

---

【重要】
以下のJSON形式で回答してください。

\`\`\`json
{
  "frame1Not": "1コマ目で描くべきでない内容の説明文",
  "frame1Must": "1コマ目で必ず描くべき内容の説明文",
  "frame2Not": "2コマ目で描くべきでない内容の説明文",
  "frame2Must": "2コマ目で必ず描くべき内容の説明文"
}
\`\`\``;

  const response = await openai.responses.create({
    model: TEXT_MODEL,
    input: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });
  const content = response.output_text ?? '';
  const match = content.match(/```json\n([\s\S]*?)```/);
  if (!match?.[1]) {
    return {
      frame1Not: 'これから起こるべきこと・まだ起こっていないことは描かないこと',
      frame1Must: '話しかけている人物を描く',
      frame2Not: 'これから起こるべきこと・まだ起こっていないことは描かないこと',
      frame2Must: '返答している人物を描く',
    };
  }
  return JSON.parse(match[1]) as FrameRestrictions;
}

/**
 * 画像プロンプトを生成
 */
export function generateImagePrompt(
  problem: GeneratedProblem,
  frameRestrictions?: FrameRestrictions,
): string {
  const senderGenderText = getGenderInJapanese(problem.senderVoice);
  const receiverGenderText = getGenderInJapanese(problem.receiverVoice);

  const senderName = problem.senderName;
  const receiverName = problem.receiverName;

  return `上下半分に分割された写真を生成すること。
上下の高さは正確に同じであること。

【重要】
- 上半分、下半分を通して、それぞれの人物の服装や髪型は変わらないこと。

【登場人物】
- 話しかける人（sender）
  - ${senderName}（${senderGenderText}）・・・${problem.senderRole}。服装や髪型は普通だが、俳優・モデル・アイドルのような絶世の美貌の持ち主。
- 話しかけられて応答する人（receiver）
  - ${receiverName}（${receiverGenderText}）・・・${problem.receiverRole}。服装や髪型は普通だが、俳優・モデル・アイドルのような絶世の美貌の持ち主。

【シーン情報】
${buildSceneText(problem)}

【上半分】
- ${senderName}（${problem.senderRole}・${senderGenderText}）が「${problem.englishSentence}」と言っている。
- 吹き出し・台詞・字幕は描かないこと。写真だけで表現すること。

【下半分】
- ${receiverName}（${problem.receiverRole}・${receiverGenderText}）が「${problem.englishReply}」と返答している。上半分とは別のアングルで描画すること。
- 吹き出し・台詞・字幕は描かないこと。写真だけで表現すること。

【備考】
- 生成AIっぽくない、自然な本物の写真を生成すること。

【描くべきこと】
${
  frameRestrictions
    ? `- 上半分: ${frameRestrictions.frame1Must}\n- 下半分: ${frameRestrictions.frame2Must}`
    : ''
}

【描かないこと】
${
  frameRestrictions
    ? `- 上半分: ${frameRestrictions.frame1Not}\n- 下半分: ${frameRestrictions.frame2Not}`
    : `- 要するに「これから起こるべきこと・まだ起こっていないこと」は画像に描かないこと`
}
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
  const senderVoiceInstruction = buildSenderVoiceInstruction({
    senderRole: problem.senderRole,
    senderVoice: problem.senderVoice === 'male' ? '男性' : '女性',
    receiverRole: problem.receiverRole,
    receiverVoice: problem.receiverVoice === 'male' ? '男性' : '女性',
  });
  const receiverVoiceInstruction = buildReceiverVoiceInstruction({
    senderRole: problem.senderRole,
    senderVoice: problem.senderVoice === 'male' ? '男性' : '女性',
    receiverRole: problem.receiverRole,
    receiverVoice: problem.receiverVoice === 'male' ? '男性' : '女性',
    englishSentence: problem.englishSentence,
    englishReply: problem.englishReply ?? '',
  });

  const audioPromises = [
    generateSpeech(
      problem.englishSentence,
      voiceTypeToVoiceGender(problem.senderVoice),
      'en',
      senderVoiceInstruction,
    ),
    generateSpeech(
      problem.japaneseReply,
      voiceTypeToVoiceGender(problem.receiverVoice),
      'ja',
      receiverVoiceInstruction,
    ),
  ];

  // englishReplyがある場合は英語返答の音声も生成
  if (problem.englishReply) {
    audioPromises.push(
      generateSpeech(
        problem.englishReply,
        voiceTypeToVoiceGender(problem.receiverVoice),
        'en',
        receiverVoiceInstruction,
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
  const senderVoiceInstruction = buildSenderVoiceInstruction({
    senderRole: problem.senderRole,
    senderVoice: problem.senderVoice === 'male' ? '男性' : '女性',
    receiverRole: problem.receiverRole,
    receiverVoice: problem.receiverVoice === 'male' ? '男性' : '女性',
  });
  const receiverVoiceInstruction = buildReceiverVoiceInstruction({
    senderRole: problem.senderRole,
    senderVoice: problem.senderVoice === 'male' ? '男性' : '女性',
    receiverRole: problem.receiverRole,
    receiverVoice: problem.receiverVoice === 'male' ? '男性' : '女性',
    englishSentence: problem.englishSentence,
    englishReply: problem.englishReply ?? '',
  });

  const audioBufferPromises = [
    generateSpeechBuffer(
      problem.englishSentence,
      voiceTypeToVoiceGender(problem.senderVoice),
      'en',
      senderVoiceInstruction,
    ),
    generateSpeechBuffer(
      problem.japaneseReply,
      voiceTypeToVoiceGender(problem.receiverVoice),
      'ja',
      receiverVoiceInstruction,
    ),
  ];

  // englishReplyがある場合は英語返答の音声も生成
  if (problem.englishReply) {
    audioBufferPromises.push(
      generateSpeechBuffer(
        problem.englishReply,
        voiceTypeToVoiceGender(problem.receiverVoice),
        'en',
        receiverVoiceInstruction,
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
  const frameRestrictions = await generateFrameRestrictions(problem);
  const imagePrompt = generateImagePrompt(problem, frameRestrictions);
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
  const frameRestrictions = await generateFrameRestrictions(problem);
  const imagePrompt = generateImagePromptWithCharacters(problem, frameRestrictions);
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
  const frameRestrictions = await generateFrameRestrictions(problem);
  const imagePrompt = generateImagePromptWithAnimals(problem, frameRestrictions);
  const imageBuffer = await generateImageWithCharactersBuffer(animalImages, imagePrompt);
  return await uploadImageToR2(imageBuffer, problemId, 'composite');
}

/**
 * キャラクター設定画像を使った画像生成用のプロンプトを生成
 */
export function generateImagePromptWithCharacters(
  problem: GeneratedProblem,
  frameRestrictions?: FrameRestrictions,
): string {
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

【登場人物】
- ${senderName}（${senderGenderText}）・・・${problem.senderRole}。
- ${receiverName}（${receiverGenderText}）・・・${problem.receiverRole}。

※ビデオ会議の場合は、必ず登場人物たちにイヤフォンなどを着用させてください。通常の電話であれば不要です。

【シーン情報】
${buildSceneText(problem)}

【1コマ目】
- ${senderName}（${senderGenderText}）が${senderFaceDirection}に向かって「${problem.englishSentence}」と言っている。
- ただし、吹き出しは不要です。台詞も不要です。枠線も不要です。字幕も不要です。油絵だけで表現してください。
- まだ${receiverName}（${receiverGenderText}）は描かないこと。

【2コマ目】
- ${receiverName}（${receiverGenderText}）が${receiverFaceDirection}に向かって「${problem.englishReply}」と返答している。1コマ目とは左右逆のアングルで描画すること。
- ただし、吹き出しは不要です。台詞も不要です。枠線も不要です。字幕も不要です。油絵だけで表現してください。
- もう${senderName}（${senderGenderText}）は描かないこと。

【備考】
- 1コマ目、2コマ目を通して、それぞれの人物の服装や髪型は変わらないこと。
- 生成AIっぽくない、自然な本物の油絵を生成すること。

## 重要
- 上下のコマの高さは正確に同じであること。
- 入力されたキャラクター画像の特徴を忠実に再現すること。

【禁止事項】
- 1つのコマの中に同じ人物を2回描画してはならない。
- キャラクター画像と異なる顔や服装にしてはならない。
- ビデオ会議のシーンの場合は、必ず登場人物たちにイヤフォンなどを着用させてください。通常の電話であれば不要です。

【描くべきこと】
${
  frameRestrictions
    ? `- 1コマ目: ${frameRestrictions.frame1Must}\n- 2コマ目: ${frameRestrictions.frame2Must}`
    : ''
}

【描かないこと】
${
  frameRestrictions
    ? `- 1コマ目: ${frameRestrictions.frame1Not}\n- 2コマ目: ${frameRestrictions.frame2Not}`
    : `- 要するに「これから起こるべきこと・まだ起こっていないこと」は画像に描かないこと`
}
`;
}

/**
 * 動物キャラクター用の画像プロンプトを生成
 */
export function generateImagePromptWithAnimals(
  problem: GeneratedProblem,
  frameRestrictions?: FrameRestrictions,
): string {
  // 動物の種類を性別で決定（male=黒猫、female=白猫）
  const senderAnimal = problem.senderVoice === 'male' ? '黒猫' : '白猫';
  const receiverAnimal = problem.receiverVoice === 'male' ? '黒猫' : '白猫';

  const senderName = problem.senderVoice === 'male' ? 'クロ' : 'シロ';
  const receiverName = problem.receiverVoice === 'male' ? 'クロ' : 'シロ';

  const [senderFaceDirection, receiverFaceDirection] =
    senderFaceDirectionMap[Math.floor(Math.random() * senderFaceDirectionMap.length)];

  return `入力画像として参考画像が提供されています。
この画像の画風・絵柄・タッチを完全に模倣してください。

上下に分割された画像を生成すること。枠線は無し。
上下の画像の高さは正確に同じであること。

【重要】
- 入力画像と同じ画風・絵柄で描くこと。完全に模倣すること。表情は無表情。
- 枠線を書くことは禁止する。
- 登場人物はすべて猫です。
- 上下の画像を通して、それぞれの猫の特徴（毛色、模様、体型）は変わらないこと。

【上下の画像の高さ】
上下の画像の高さは正確に同じであること。
上下の画像の間に空白はゼロ。
周りの余白もゼロ。枠線は禁止。

【登場キャラクター】
- 話しかける猫（sender）
  - ${senderName}（${senderAnimal}）・・・${problem.senderRole}として行動する猫。
- 話しかけられて応答する猫（receiver）
  - ${receiverName}（${receiverAnimal}）・・・${problem.receiverRole}として行動する猫。

猫ちゃんたちは人間のように働いたりできます。
猫ちゃんたちはいついかなる時も真顔で無表情です。真剣に、愚かで拙い行動をします。

【シーン情報】
${buildSceneText(problem)}

【上半分の画像】
- ${senderName}（${senderAnimal}）は画像の${receiverFaceDirection}にいて、${senderFaceDirection}を向いて「${problem.englishSentence}」と言っている。
- ただし、吹き出しや台詞や字幕は描かないこと。絵だけで表現すること。枠線は書くな。
- まだ${receiverName}（${receiverAnimal}）は描かないこと。

【下半分の画像】
- ${receiverName}（${receiverAnimal}）は画像の${senderFaceDirection}にいて、${receiverFaceDirection}を向いて「${problem.englishReply}」と返答している。つまり上の画像とは左右逆のアングルで描画すること。
- ただし、吹き出しや台詞や字幕は描かないこと。絵だけで表現すること。枠線は書くな。
- もう${senderName}（${senderAnimal}）は描かないこと。

【備考】
- 入力画像と同じ画風で描くこと。完全に模倣すること。表情は無表情。
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

【描くべきこと】
${
  frameRestrictions
    ? `- 1コマ目: ${frameRestrictions.frame1Must}\n- 2コマ目: ${frameRestrictions.frame2Must}`
    : ''
}

【描かないこと】
${
  frameRestrictions
    ? `- 1コマ目: ${frameRestrictions.frame1Not}\n- 2コマ目: ${frameRestrictions.frame2Not}`
    : `- 要するに「これから起こるべきこと・まだ起こっていないこと」は画像に描かないこと`
}
`;
}

export type TranslateJapaneseParams = {
  place: string;
  how: string;
  senderWhen: string;
  receiverPlace: string;
  senderWhy: string;
  senderWant: string;
  senderRole: string;
  senderGender: '男性' | '女性';
  senderName: string;
  englishSentence: string;
  receiverRole: string;
  receiverGender: '男性' | '女性';
  receiverName: string;
  englishReply: string;
  /** 翻訳対象: 'sender'=1コマ目、'receiver'=2コマ目 */
  translate: 'sender' | 'receiver';
};

/**
 * 英会話の片方の発話を、会話の文脈を踏まえて日本語に翻訳する。
 * 1コマ目（送り手）・2コマ目（受け手）どちらの翻訳にも使用できる共通関数。
 * エラー時は Error を throw する。
 */
export async function translateJapanese(
  openai: OpenAI,
  params: TranslateJapaneseParams,
): Promise<string> {
  const {
    place,
    how,
    senderWhen,
    receiverPlace,
    senderWhy,
    senderWant,
    senderRole,
    senderName,
    senderGender,
    englishSentence,
    receiverRole,
    receiverName,
    receiverGender,
    englishReply,
    translate,
  } = params;
  const prompt = `
  【翻訳すべき英文】
  ${translate === 'sender' ? englishSentence : englishReply}

  ${buildJapaneseConversationRules({
    senderName,
    receiverName,
    senderRole,
    senderGender,
    receiverRole,
    receiverGender,
    englishSentence,
    englishReply,
    translate,
    how,
  })}

【シーン情報】
${buildSceneText({
  how,
  senderWhen,
  place,
  senderRole,
  senderName,
  senderVoice: senderGender === '男性' ? 'male' : 'female',
  receiverPlace,
  receiverRole,
  receiverName,
  receiverVoice: receiverGender === '男性' ? 'male' : 'female',
  senderWhy,
  senderWant,
})}

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "japanese": "ここに翻訳結果の日本語が入る。"
}
\`\`\``;

  const response = await openai.responses.create({
    model: TEXT_MODEL,
    input: [{ role: 'user', content: prompt }],
    temperature: 0.5,
  });

  if (response.status === 'incomplete') {
    throw new Error('AI応答が不完全でした。');
  }

  const content = response.output_text;
  if (!content) {
    throw new Error('AI応答が空でした。');
  }

  const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
  if (!jsonMatch?.[1]) {
    throw new Error('AI応答のパースに失敗しました。');
  }

  const result = JSON.parse(jsonMatch[1]) as { japanese: string };
  if (!result.japanese) {
    throw new Error('japanese が取得できませんでした。');
  }

  return result.japanese.trim();
}

export type BuildJapaneseConversationRulesParams = {
  senderName: string;
  senderRole: string;
  senderGender: string;
  receiverName: string;
  receiverRole: string;
  receiverGender: string;
  englishSentence: string;
  englishReply: string;
  how: string;
  /** 翻訳対象: 'sender'=送り手の発話、'receiver'=受け手の返答。省略時は会話全体を翻訳 */
  translate?: 'sender' | 'receiver';
};

/**
 * 日本語会話翻訳プロンプトの翻訳指示部分を組み立てる。
 * create-problems3.ts などのスクリプトから利用する。
 */
export function buildJapaneseConversationRules(
  params: BuildJapaneseConversationRulesParams,
): string {
  const {
    senderRole,
    senderName,
    senderGender,
    receiverRole,
    receiverGender,
    receiverName,
    englishSentence,
    englishReply,
    how,
    translate,
  } = params;

  const targetDescription =
    translate === 'sender'
      ? `この${senderRole}（${senderGender}）の「${englishSentence}」を自然な日本語のセリフに翻訳してください。`
      : translate === 'receiver'
        ? `この${receiverRole}（${receiverGender}）の「${englishReply}」を自然な日本語のセリフに翻訳してください。`
        : 'この会話を自然な日本語のセリフに翻訳してください。';

  return `
  ${how ? `- ${how}での会話です。` : ''}
  ${senderName}（${senderRole}・${senderGender}）が「${englishSentence}」と話しかけ、
  ${receiverName}（${receiverRole}・${receiverGender}）が「${englishReply}」と返答しました。
  ${targetDescription}
  二人の関係性を考慮して、自然な口調のセリフに翻訳してください。
  慣用句は単語通りに直訳せず、慣用句として翻訳してください。
  元の英文に含まれる内容はできるだけ省略せずに日本語に翻訳してください。
  元の英文に含まれていない文脈情報は日本語訳に含めないでください。元の英文に含まれている内容のみを日本語に訳してください。
  「誰が」という内容を省略しないでください。（例: "So nervous was she that she dropped her notes."であれば「あまりにも緊張してノートを落としちゃったんだよ。」ではなく「彼女、あまりにも緊張してノートを落としちゃったんだよ。」とすること。）
  カタカナ英語は避け、ちゃんと日本語に翻訳すること。ただし、日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。（例: check-in は チェックイン でOK）
  機械音声で読み上げるための日本語文なので、括弧書きは含めないこと。最後は「。」または「？」で終わること。
  女性のセリフを「〜だわ」「〜なのよ」と翻訳するのは古臭いので禁止です。
  セリフの最初に「タカシ：やあ、こんにちは」と話者の名前をつけるのは、やめてください。`;
}
