import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { generateSpeech, generateSpeechBuffer } from '@/lib/audio-utils';
import { generateImageBuffer } from '@/lib/image-utils';
import { uploadAudioToR2, uploadImageToR2 } from '@/lib/r2-client';
import type { VoiceGender } from '@/config/voice';

import type { Problem } from '@prisma/client';

import { saveGeneratedProblem } from '@/lib/problem-storage';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ProblemLength = 'short' | 'medium' | 'long';

type GenerateRequest = {
  type?: ProblemLength;
  nuance?: string;
  genre?: (typeof GENRE_POOL)[number];
  withoutPicture?: boolean;
  skipSave?: boolean;
};

// Prismaの型を拡張して使用
type GeneratedProblem = Omit<
  Problem,
  'id' | 'createdAt' | 'updatedAt' | 'audioEnUrl' | 'audioJaUrl' | 'imageUrl' | 'incorrectOptions'
> & {
  incorrectOptions: string[];
};

export const WORD_COUNT_RULES: Record<ProblemLength, { min: number; max: number }> = {
  short: { min: 1, max: 6 },
  medium: { min: 7, max: 10 },
  long: { min: 11, max: 20 },
};

/**
 * WORD_COUNT_RULESから指定されたタイプの単語数配列を動的に生成
 * 例: short タイプの場合 [2, 3, 4, 5, 6] を返す
 */
function generateWordCountArray(type: ProblemLength): number[] {
  const rule = WORD_COUNT_RULES[type];
  const wordCounts: number[] = [];
  for (let i = rule.min; i <= rule.max; i++) {
    wordCounts.push(i);
  }
  return wordCounts;
}

/**
 * 指定されたタイプから単語数をランダムに選択
 */
function selectRandomWordCount(type: ProblemLength): number {
  const wordCountArray = generateWordCountArray(type);
  return wordCountArray[Math.floor(Math.random() * wordCountArray.length)];
}

const LENGTH_POOL = ['short', 'medium', 'long'] as const;

const INITIAL_ALPHABETS = [
  'A',
  'A',
  'A',
  'A',
  'A',
  'A',
  'A',
  'A',
  'A',
  'A',
  'A',
  'A',
  'B',
  'B',
  'B',
  'B',
  'B',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'C',
  'D',
  'D',
  'D',
  'D',
  'E',
  'E',
  'E',
  'F',
  'F',
  'F',
  'F',
  'G',
  'G',
  'H',
  'H',
  'H',
  'H',
  'H',
  'H',
  'H',
  'I',
  'I',
  'I',
  'I',
  'I',
  'I',
  'K',
  'L',
  'L',
  'L',
  'L',
  'M',
  'M',
  'M',
  'M',
  'M',
  'M',
  'M',
  'N',
  'N',
  'O',
  'O',
  'O',
  'P',
  'P',
  'P',
  'P',
  'R',
  'R',
  'R',
  'R',
  'R',
  'S',
  'S',
  'S',
  'S',
  'S',
  'S',
  'S',
  'S',
  'T',
  'T',
  'T',
  'T',
  'T',
  'T',
  'T',
  'U',
  'U',
  'V',
  'W',
  'W',
  'W',
  'W',
  'W',
  'W',
  'Y',
  'Y',
];

const GENRE_POOL = ['依頼', '質問', '提案', '意見', '情報共有'] as const;

const SCENE_POOL = [
  {
    place: '家庭',
    roles: [
      ['妻', '夫'],
      ['娘', '父親'],
      ['母親', '息子'],
    ],
  },
  {
    place: 'オフィス',
    roles: [
      ['部下', '上司'],
      ['親しい同僚', '親しい同僚'],
      ['新人', '先輩'],
    ],
  },
  {
    place: '公園',
    roles: [
      ['親しい友人', '親しい友人'],
      ['母親', '子供'],
      ['父親', '子供'],
    ],
  },
  {
    place: '旅行先',
    roles: [
      ['旅行者', '現地ガイド'],
      ['観光客', 'ホテルスタッフ'],
      ['客', '　店員'],
    ],
  },
  {
    place: '学校',
    roles: [
      ['学生', '先生'],
      ['生徒', '先輩'],
      ['親しい同級生', '親しい同級生'],
    ],
  },
  {
    place: '病院',
    roles: [
      ['患者', '医師'],
      ['患者', '看護師'],
      ['医師', '患者'],
    ],
  },
  {
    place: '駅',
    roles: [
      ['乗客', '駅員'],
      ['旅行者', '案内係'],
      ['親しい友人', '親しい友人'],
    ],
  },
  {
    place: '飲食店',
    roles: [
      ['客', '店員'],
      ['店員', '客'],
      ['親しい友人', '親しい友人'],
    ],
  },
  {
    place: 'スポーツ施設',
    roles: [
      ['会員', 'インストラクター'],
      ['初心者', 'コーチ'],
      ['親しい仲間', '親しい仲間'],
    ],
  },
  {
    place: 'ショッピングモール',
    roles: [
      ['客', '店員'],
      ['案内係', '買い物客'],
      ['親しい友人', '親しい友人'],
    ],
  },
  {
    place: '結婚式',
    roles: [
      ['ゲスト', '式場スタッフ'],
      ['親しい友人', '親しい友人'],
      ['親族', '新郎'],
    ],
  },
  {
    place: '電話',
    roles: [
      ['顧客', 'オペレーター'],
      ['親しい友人', '親しい友人'],
      ['妻', '夫'],
    ],
  },
] as const;

function mapProblemLength(type?: string): ProblemLength {
  if (type === 'medium' || type === 'long') {
    return type;
  }
  return 'short';
}

function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
}

/**
 * 指定されたtypeとinitial_alphabetの組み合わせで既存の英文を全件取得
 */
async function getExistingEnglishTexts(length: ProblemLength): Promise<Set<string>> {
  let wordCountRange: { gte?: number; lte?: number };

  switch (length) {
    case 'short':
      wordCountRange = { lte: 3 };
      break;
    case 'medium':
      wordCountRange = { gte: 4, lte: 8 };
      break;
    case 'long':
      wordCountRange = { gte: 9 };
      break;
  }

  const whereClause = {
    wordCount: wordCountRange,
  };

  const existing = await prisma.problem.findMany({
    where: whereClause,
    select: {
      englishSentence: true,
    },
  });

  return new Set(existing.map((item) => item.englishSentence));
}

/**
 * 指定されたアルファベットで始まる英文とニュアンスを生成
 */
async function generateEnglishSentence(
  type: ProblemLength,
  initialAlphabet: string,
  scene: string,
  genre: string,
  characterRoles: { character1: string; character2: string },
  targetWordCount: number,
): Promise<{ english: string; nuance: string }> {
  ensureApiKey();

  const prompt = `以下の条件を満たす英文を生成してください。

【条件】
- ${targetWordCount}単語で構成された英文であること。
- 最初の1文字は${initialAlphabet}であること。
- ${scene}で${characterRoles.character1}（女性）が${characterRoles.character2}（男性）に対して言う台詞として自然であること。
- その場面でよく使われる自然な英文にしてください。
- 二人の関係性や場面に合わせたニュアンスの英文であること（カジュアル または フォーマル）

【出力】
以下のJSON形式で出力してください：
{
  "english": "生成された英文",
  "nuance": "カジュアル または フォーマル"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const rawText = response.choices[0]?.message?.content?.trim() || '';

  let parsed: { english: string; nuance: string };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Failed to parse English generation response as JSON');
  }

  if (!parsed.english || !parsed.nuance) {
    throw new Error('Missing english or nuance in response');
  }

  if (!parsed.english.startsWith(initialAlphabet)) {
    console.warn(
      `⚠️ Warning: Generated English sentence does not start with "${initialAlphabet}", but continuing anyway. Sentence: "${parsed.english}"`,
    );
  }

  return { english: parsed.english, nuance: parsed.nuance };
}

/**
 * 重複のない英文を生成（最大10回リトライ）
 */
async function generateUniqueEnglish(
  length: ProblemLength,
  scene: string,
  genre: string,
  characterRoles: { character1: string; character2: string },
  targetWordCount: number,
): Promise<{ english: string; nuance: string }> {
  const maxRetries = 10;

  // 1回だけDBアクセスして既存の英文を取得
  const existingEnglishTexts = await getExistingEnglishTexts(length);
  console.log(
    `[generateUniqueEnglish] Found ${existingEnglishTexts.size} existing English texts for ${length}`,
  );

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await generateEnglishSentence(
      length,
      'A', // 固定値として'A'を使用
      scene,
      genre,
      characterRoles,
      targetWordCount,
    );

    // メモリ内でSetを使って高速チェック
    if (!existingEnglishTexts.has(result.english)) {
      console.log(
        `[generateUniqueEnglish] Generated unique English on attempt ${attempt}: "${result.english}" (${result.nuance})`,
      );
      return result;
    }

    console.log(
      `[generateUniqueEnglish] Duplicate found on attempt ${attempt}: "${result.english}". Retrying...`,
    );
  }

  throw new Error(`Failed to generate unique English sentence after ${maxRetries} attempts`);
}

/**
 * systemPromptを作成
 */
function createSystemPrompt(
  scene: string,
  genre: string,
  english: string,
  characterRoles: { character1: string; character2: string },
): string {
  return `以下の仕様を満たす JSON オブジェクトのみを返してください。

【出力フィールド】
- english, japaneseReply, options(配列), correctIndex, scenePrompt, speakers, interactionIntent。
- englishフィールドの内容: ${english}

【このJSONオブジェクトを作成する目的】
  ${characterRoles.character2}（男性）の日本語での返事をヒントに${characterRoles.character1}（女性）の英語台詞「${english}」の意味を当てるクイズを作成したい。

【選択肢】
- options は日本語4文（全て自然な口語）。
- options[0] は正解の選択肢です。つまり「${english}」の正しい日本語訳です。日本語としての自然な言い回しにしてください。単語も日本語らしく訳すべし（例: 「platform」なら「プラットフォーム」ではなく「ホーム」）。
  - 悪い例: 「You should try this park.」→「この公園を試してみた方がいいよ。」
  - 良い例: 「You should try this park.」→「この公園、ぜひ行ってみてください。」
- options[0] は英文のフォーマルさ・カジュアルさ・丁寧さのレベルを日本語でも同等に保つこと。例：「Could you please...」→「〜していただけませんか」、「Can you...」→「〜してくれる？」、「Help me」→「手伝って」。
- options[1], options[2], options[3] は誤答。この場面で${characterRoles.character1}（女性）が言うはずのない無関係な日本語セリフです。文字数はoptions[0]と同じくらいにしてください。
- correctIndex は常に 0。

【japaneseReply】
- ${scene}で、${characterRoles.character1}（女性）が${characterRoles.character2}（男性）に対して「${english}」と言います。それに対する${characterRoles.character2}（男性）の返答の日本語文をjapaneseReplyフィールドに入れること。
- japaneseReplyは、englishの日本語訳ではありません。englishに対する返答です。options[0]（「${english}」の日本語訳）に対する${characterRoles.character2}（男性）の返答です。
  - ${characterRoles.character2}（男性）が即座に返す自然で簡潔な口語文。日本人が実際に使う自然な台詞を生成してください。
  - japaneseReplyは返答なので、options[0]の内容と同じになることはありません。
- japaneseReplyを読むことでenglishがどんな英文なのか推測できるような文章にしてください。
  - 例えばjapaneseReplyで「はい、〇〇どうぞ」と返答することで「何かを要求するenglishなのだろうな」と推測できるように。
  - 悪い例: options[0]が「来週の会議のテーマは何だっけ？」だった場合に「うん、そのことね。」というjapaneseReplyは不適切。japaneseReplyからenglishが何なのか全く推測できない。
  - 良い例: options[0]が「ボールから目を離さないで。」だった場合に「うん、ボールに集中するね。」というjapaneseReplyは適切。japaneseReplyからenglishが何となく推測できる。
- 文頭には適切な相槌や感動詞を付けてほしい。
  - 相槌や感動詞の例: 「うん」「はい」「そうだなぁ」「どうぞ」「いいね」「ほら」「いや」「いいえ」「ああ」「そうだね」「そうですね」「わかりました」など
  - 文の例: 「うん、〇〇しよう」「どうぞ、〇〇だよ」「いいね、〇〇だね」「いや、〇〇だと」「そうですね、〇〇ですものね」
- japaneseReplyは、englishをただ日本語訳しただけのようなオウム返しではダメです。
  - 悪い例: Let me share this. → ああ、それについて教えて。
  - 良い例: Let me share this. → うん、教えてくれる？

【重要】
- japaneseReplyは、englishに対する返答の台詞を生成してください。englishの日本語訳ではありません。
- options[0] には英文クイズの正解が入ります。「${english}」の正しい日本語訳を入れてください。
`;
}

async function generateProblem(input: GenerateRequest): Promise<GeneratedProblem> {
  ensureApiKey();

  // 1. LENGTH_POOLからランダム選択（リクエストで指定されていない場合）
  let length: ProblemLength;

  if (input.type) {
    length = mapProblemLength(input.type);
  } else {
    length = LENGTH_POOL[Math.floor(Math.random() * LENGTH_POOL.length)] as ProblemLength;
  }

  // 単語数を決めうち
  const targetWordCount = selectRandomWordCount(length);

  // ランダムにsceneとgenreを選択
  const sceneData = SCENE_POOL[Math.floor(Math.random() * SCENE_POOL.length)];
  const selectedRolePair = sceneData.roles[Math.floor(Math.random() * sceneData.roles.length)];
  const genre = GENRE_POOL[Math.floor(Math.random() * GENRE_POOL.length)];

  const place = sceneData.place;
  const characterRoles = {
    character1: selectedRolePair[0],
    character2: selectedRolePair[1],
  };

  // 2. 重複のない英文を生成（ニュアンスはAIが自動選択）
  const { english, nuance } = await generateUniqueEnglish(
    length,
    place,
    genre,
    characterRoles,
    targetWordCount,
  );

  // 3. systemPromptを作成して、生成された英文を元に問題の詳細を作成
  const systemPrompt = createSystemPrompt(place, genre, english, characterRoles);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: systemPrompt,
      },
    ],
  });

  const rawText = response.choices[0]?.message?.content ?? '';

  const extractJson = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    const codeFenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (codeFenceMatch) {
      return codeFenceMatch[1];
    }

    const braceMatch = trimmed.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return braceMatch[0];
    }

    return null;
  };

  const jsonText = extractJson(rawText);
  if (!jsonText) {
    throw new Error('Failed to parse model response as JSON');
  }

  type ModelResponse = {
    english: string;
    japanese?: string;
    japaneseSentence?: string;
    japaneseReply?: string;
    options: unknown;
    incorrectOptions: unknown;
    correctIndex?: number;
    scenePrompt?: string;
    speakers?: {
      character1?: string;
      character2?: string;
    };
    interactionIntent?: string;
  };

  let parsed: ModelResponse;
  try {
    parsed = JSON.parse(jsonText) as ModelResponse;
  } catch (err) {
    const repaired = sanitizeJson(jsonText);
    try {
      parsed = JSON.parse(repaired) as ModelResponse;
    } catch (err2) {
      console.error('[problem/generate] JSON parse error', err, jsonText);
      console.error('[problem/generate] JSON parse retry failed', err2, repaired);
      throw new Error('Failed to parse model response as JSON');
    }
  }

  if (
    typeof parsed.english !== 'string' ||
    (typeof parsed.japanese !== 'string' && typeof parsed.japaneseSentence !== 'string') ||
    typeof parsed.japaneseReply !== 'string' ||
    (!Array.isArray(parsed.options) && !Array.isArray(parsed.incorrectOptions))
  ) {
    console.error('[problem/generate] Missing fields in response:', {
      hasEnglish: typeof parsed.english === 'string',
      hasJapanese: typeof parsed.japanese === 'string',
      hasJapaneseSentence: typeof parsed.japaneseSentence === 'string',
      hasJapaneseReply: typeof parsed.japaneseReply === 'string',
      hasOptions: Array.isArray(parsed.options),
      hasIncorrectOptions: Array.isArray(parsed.incorrectOptions),
      actualResponse: parsed,
    });
    throw new Error('Model response missing required fields');
  }

  // 新しいスキーマに合わせた処理
  const japaneseSentence = parsed.japaneseSentence || parsed.japanese || '';
  const incorrectOptions = Array.isArray(parsed.incorrectOptions)
    ? parsed.incorrectOptions.map((option: unknown) => String(option))
    : Array.isArray(parsed.options)
      ? parsed.options.slice(1).map((option: unknown) => String(option)) // 最初を除いた残り
      : [];

  // 音声の性別を決定
  const senderVoice =
    characterRoles.character1.includes('女性') ||
    characterRoles.character1.includes('娘') ||
    characterRoles.character1.includes('母親')
      ? 'female'
      : 'male';
  const receiverVoice =
    characterRoles.character2.includes('女性') ||
    characterRoles.character2.includes('娘') ||
    characterRoles.character2.includes('母親')
      ? 'female'
      : 'male';

  const problem: GeneratedProblem = {
    wordCount: targetWordCount,
    englishSentence: parsed.english || english,
    japaneseSentence,
    japaneseReply: parsed.japaneseReply ?? '',
    incorrectOptions,
    senderVoice,
    senderRole: characterRoles.character1,
    receiverVoice,
    receiverRole: characterRoles.character2,
    place,
  };

  return problem;
}

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

function sanitizeJson(text: string): string {
  let sanitized = text.trim();
  sanitized = sanitized
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([}\]])/g, '$1');

  if (!sanitized.startsWith('{') && sanitized.includes('{')) {
    sanitized = sanitized.slice(sanitized.indexOf('{'));
  }
  if (!sanitized.endsWith('}') && sanitized.lastIndexOf('}') !== -1) {
    sanitized = sanitized.slice(0, sanitized.lastIndexOf('}') + 1);
  }

  return sanitized;
}

async function generateImage(prompt: string) {
  ensureApiKey();
  const image = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1536',
  });

  const first = image.data?.[0];
  if (!first) {
    console.error('[problem/generate] image generation returned no data', image);
    throw new Error('Failed to generate image');
  }

  if (first.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  if (first.url) {
    return first.url;
  }

  console.error('[problem/generate] image generation missing url/b64_json', first);
  throw new Error('Failed to generate image');
}

export async function POST(req: Request) {
  try {
    const body: GenerateRequest = await req.json().catch(() => ({}));
    const problem = await generateProblem(body);

    const imagePrompt = `実写風の2コマ漫画を生成してください。
縦に2コマです。
漫画ですが、吹き出し・台詞は描かないこと。写真のみで表現してください。
上下のコマの高さは完全に同じであること。
上下のコマの間に高さ20ピクセルの白い境界線が必要です。

【場所】
${problem.place}

【登場人物】
${problem.senderRole}（送信者）
${problem.receiverRole}（受信者）

【ストーリー】
${problem.senderRole}が${problem.receiverRole}に対して「${problem.englishSentence}」と言う。それに対し、${problem.receiverRole}が「${problem.japaneseReply}」と答える。

【1コマ目】
- ${problem.place}で${problem.senderRole}が「${problem.englishSentence}」と言っている様子を描いてください。
- ${problem.receiverRole}はまだ描かないこと。

【2コマ目】
- ${problem.senderRole}の台詞を聞いた${problem.receiverRole}が${problem.place}で「${problem.japaneseReply}」と反応した様子を描いてください。

【備考】
- 場所や場面に合わせた表情やジェスチャーを描写してください。
- 漫画ですが、吹き出し・台詞は描かないこと。写真のみで表現してください。
- 自然で生成AIっぽくないテイストで描写してください。`;

    // 一意のproblemId生成（タイムスタンプベース）
    const problemId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log('[problem/generate] 🎯 ステップ1: アセット生成開始');

    // skipSaveが true の場合はBase64で返す（R2アップロードなし）
    if (body.skipSave) {
      console.log('[problem/generate] 🧪 テストモード: Base64アセット生成');

      try {
        // 並列でアセット生成（Base64形式）
        const assetPromises: Promise<string>[] = [
          generateSpeech(problem.englishSentence, problem.senderVoice as VoiceGender),
          generateSpeech(
            problem.japaneseReply || problem.englishSentence,
            problem.receiverVoice as VoiceGender,
          ),
        ];

        if (!body.withoutPicture) {
          assetPromises.push(generateImage(imagePrompt));
        }

        const results = await Promise.all(assetPromises);

        const englishAudio = results[0];
        const japaneseAudio = results[1];
        const compositeScene = !body.withoutPicture && results[2] ? results[2] : null;

        console.log('[problem/generate] ✅ テストモード完了: Base64アセット生成成功');

        const responseAssets = {
          composite: compositeScene,
          imagePrompt: imagePrompt,
          audio: {
            english: englishAudio,
            japanese: japaneseAudio,
          },
        } as const;

        return NextResponse.json({
          problem: {
            wordCount: problem.wordCount,
            englishSentence: problem.englishSentence,
            japaneseSentence: problem.japaneseSentence,
            japaneseReply: problem.japaneseReply,
            incorrectOptions: problem.incorrectOptions,
            senderVoice: problem.senderVoice,
            senderRole: problem.senderRole,
            receiverVoice: problem.receiverVoice,
            receiverRole: problem.receiverRole,
            place: problem.place,
          },
          assets: responseAssets,
        });
      } catch (testError) {
        console.error('[problem/generate] ❌ テストモード失敗:', testError);
        throw testError;
      }
    }

    // 通常モード: R2アップロード + DB保存
    console.log('[problem/generate] 🚀 本番モード: R2アップロード + DB保存');

    // ステップ1: 全てのアセットを生成（メモリ内で完了）
    let imageBuffer: Buffer | null = null;
    let englishAudioBuffer: Buffer;
    let japaneseAudioBuffer: Buffer;

    try {
      // 並列でアセット生成
      const assetPromises: Promise<Buffer>[] = [
        generateSpeechBuffer(problem.englishSentence, problem.senderVoice as VoiceGender),
        generateSpeechBuffer(
          problem.japaneseReply || problem.englishSentence,
          problem.receiverVoice as VoiceGender,
        ),
      ];

      if (!body.withoutPicture) {
        assetPromises.push(generateImageBuffer(imagePrompt));
      }

      const results = await Promise.all(assetPromises);

      englishAudioBuffer = results[0];
      japaneseAudioBuffer = results[1];
      if (!body.withoutPicture && results[2]) {
        imageBuffer = results[2];
      }

      console.log('[problem/generate] ✅ ステップ1完了: 全アセット生成成功');
    } catch (generationError) {
      console.error('[problem/generate] ❌ ステップ1失敗: アセット生成エラー', generationError);
      throw generationError;
    }

    console.log('[problem/generate] 🚀 ステップ2: R2一括アップロード開始');

    // ステップ2: 全アセットを並列で一度にR2アップロード
    let englishAudio: string;
    let japaneseAudio: string;
    let compositeScene: string | null = null;

    try {
      const uploadPromises: Promise<string>[] = [
        uploadAudioToR2(englishAudioBuffer, problemId, 'en', problem.senderVoice as VoiceGender),
        uploadAudioToR2(japaneseAudioBuffer, problemId, 'ja', problem.receiverVoice as VoiceGender),
      ];

      if (imageBuffer) {
        uploadPromises.push(uploadImageToR2(imageBuffer, problemId, 'composite'));
      }

      const uploadResults = await Promise.all(uploadPromises);

      englishAudio = uploadResults[0];
      japaneseAudio = uploadResults[1];
      if (imageBuffer && uploadResults[2]) {
        compositeScene = uploadResults[2];
      }

      console.log('[problem/generate] ✅ ステップ2完了: 全アセット一括アップロード成功');
    } catch (uploadError) {
      console.error('[problem/generate] ❌ ステップ2失敗: アップロードエラー', uploadError);
      throw uploadError;
    }

    const persistAssets = {
      imageUrl: compositeScene,
      audio: {
        english: englishAudio,
        japanese: japaneseAudio,
      },
    };

    console.log('[problem/generate] 💾 ステップ3: データベース保存開始');

    let persisted = null;
    if (!body.skipSave) {
      try {
        persisted = await saveGeneratedProblem({
          problem: {
            wordCount: problem.wordCount,
            englishSentence: problem.englishSentence,
            japaneseSentence: problem.japaneseSentence,
            japaneseReply: problem.japaneseReply,
            incorrectOptions: problem.incorrectOptions,
            senderVoice: problem.senderVoice,
            senderRole: problem.senderRole,
            receiverVoice: problem.receiverVoice,
            receiverRole: problem.receiverRole,
            place: problem.place,
          },
          assets: persistAssets,
        });

        console.log('[problem/generate] ✅ ステップ3完了: DB保存成功');
      } catch (persistError) {
        console.error('[problem/generate] ❌ ステップ3失敗: DB保存エラー', persistError);
        // DB保存に失敗してもR2ファイルはそのまま残す（削除しない）
        // ファイルは正常に生成されているので、後で手動でDBに登録可能
      }
    }

    if (persisted) {
      // persistedデータにimagePromptを追加
      const persistedWithImagePrompt = {
        ...persisted,
        assets: {
          ...persisted.assets,
          imagePrompt: imagePrompt,
        },
      };
      return NextResponse.json(persistedWithImagePrompt);
    }

    const responseAssets = {
      imageUrl: compositeScene,
      imagePrompt: imagePrompt, // 常に画像プロンプトを含める
      audio: {
        english: englishAudio,
        japanese: japaneseAudio,
      },
    } as const;

    return NextResponse.json({
      problem: {
        wordCount: problem.wordCount,
        englishSentence: problem.englishSentence,
        japaneseSentence: problem.japaneseSentence,
        japaneseReply: problem.japaneseReply,
        incorrectOptions: problem.incorrectOptions,
        senderVoice: problem.senderVoice,
        senderRole: problem.senderRole,
        receiverVoice: problem.receiverVoice,
        receiverRole: problem.receiverRole,
        place: problem.place,
      },
      assets: responseAssets,
    });
  } catch (error) {
    console.error('[problem/generate] error', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
