import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { generateSpeech, generateSpeechBuffer } from '@/lib/audio-utils';
import { generateImageBuffer } from '@/lib/image-utils';
import { uploadAudioToR2, uploadImageToR2 } from '@/lib/r2-client';

import type {
  InteractionIntent as PrismaInteractionIntent,
  ProblemType as PrismaProblemType,
} from '@prisma/client';

import { saveGeneratedProblem } from '@/lib/problem-storage';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ProblemType = PrismaProblemType;

type GenerateRequest = {
  type?: ProblemType;
  nuance?: string;
  genre?: (typeof GENRE_POOL)[number];
  withoutPicture?: boolean;
  skipSave?: boolean;
};

type InteractionIntent = PrismaInteractionIntent;

type GeneratedProblem = {
  type: ProblemType;
  initialAlphabet: string;
  english: string;
  japaneseReply: string;
  options: string[];
  correctIndex: number;
  nuance: string;
  genre: string;
  scenePrompt: string;
  sceneId: string;
  speakers: {
    character1: 'male' | 'female' | 'neutral';
    character2: 'male' | 'female' | 'neutral';
  };
  characterRoles: {
    character1: string;
    character2: string;
  };
  wordCount: number;
  interactionIntent: InteractionIntent;
};

export const WORD_COUNT_RULES: Record<ProblemType, { min: number; max: number }> = {
  short: { min: 2, max: 6 },
  medium: { min: 7, max: 10 },
  long: { min: 11, max: 20 },
};

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
// const NUANCE_POOL = ['カジュアル', '砕けた', '礼儀正しい'] as const;

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
      ['同僚', '同僚'],
      ['新人', '先輩'],
    ],
  },
  {
    place: '公園',
    roles: [
      ['友人', '友人'],
      ['母親', '子供'],
      ['散歩者', '散歩者'],
    ],
  },
  {
    place: '旅行先',
    roles: [
      ['旅行者', '現地ガイド'],
      ['観光客', 'ホテルスタッフ'],
      ['友人', '友人'],
    ],
  },
  {
    place: '学校',
    roles: [
      ['学生', '先生'],
      ['生徒', '先輩'],
      ['同級生', '同級生'],
    ],
  },
  {
    place: '病院',
    roles: [
      ['患者', '医師'],
      ['患者', '看護師'],
      ['家族', '医師'],
    ],
  },
  {
    place: '駅',
    roles: [
      ['乗客', '駅員'],
      ['旅行者', '案内係'],
      ['友人', '友人'],
    ],
  },
  {
    place: '飲食店',
    roles: [
      ['客', '店員'],
      ['客', 'シェフ'],
      ['友人', '友人'],
    ],
  },
  {
    place: 'スポーツ施設',
    roles: [
      ['会員', 'インストラクター'],
      ['初心者', 'コーチ'],
      ['仲間', '仲間'],
    ],
  },
  {
    place: 'ショッピングモール',
    roles: [
      ['客', '店員'],
      ['買い物客', '案内係'],
      ['友人', '友人'],
    ],
  },
  {
    place: '結婚式',
    roles: [
      ['ゲスト', 'スタッフ'],
      ['友人', '友人'],
      ['親族', '親族'],
    ],
  },
  {
    place: '電話',
    roles: [
      ['顧客', 'オペレーター'],
      ['友人', '友人'],
      ['家族', '家族'],
    ],
  },
] as const;

function mapProblemType(type?: string): ProblemType {
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
async function getExistingEnglishTexts(
  type: ProblemType,
  initialAlphabet: string,
): Promise<Set<string>> {
  const whereClause = {
    type,
    initial_alphabet: initialAlphabet,
  };

  const existing = await prisma.problem.findMany({
    where: whereClause,
    select: {
      english: true,
    },
  });

  return new Set(existing.map((item) => item.english));
}

/**
 * LENGTH_POOLからランダムにtypeを選択し、INITIAL_ALPHABETSからランダムにアルファベットを選択
 */
function selectRandomTypeAndAlphabet(): { type: ProblemType; initialAlphabet: string } {
  const type = LENGTH_POOL[Math.floor(Math.random() * LENGTH_POOL.length)] as ProblemType;
  const initialAlphabet = INITIAL_ALPHABETS[Math.floor(Math.random() * INITIAL_ALPHABETS.length)];
  return { type, initialAlphabet };
}

/**
 * 指定されたアルファベットで始まる英文とニュアンスを生成
 */
async function generateEnglishSentence(
  type: ProblemType,
  initialAlphabet: string,
  scene: string,
  genre: string,
  characterRoles: { character1: string; character2: string },
): Promise<{ english: string; nuance: string }> {
  ensureApiKey();

  const wordCountRule = WORD_COUNT_RULES[type];

  const prompt = `あなたは英語学習アプリの出題担当です。以下の条件を満たす英文を1つだけ生成してください。

【条件】
- 英文は ${initialAlphabet} から始まること
  - 例: ${initialAlphabet} が C であれば「Can you 〜 ?」など
- 日常やビジネスでよく使うような自然な英文にしてください。
- ${scene}で${characterRoles.character1}（女性）が${characterRoles.character2}（男性）に対して言いそうな英文を生成してください。
- 具体的な文章にしてください。
  - 悪い例: 「Pass me that.」
  - 良い例: 「Pass me the salt.」

- 単語数は${wordCountRule.min}語から${wordCountRule.max}語の範囲内（必須）
- ニュアンスは場面と関係性に合わせて「カジュアル」「砕けた」「礼儀正しい」のいずれかを適切に選択

【重要な制約】
- 単語数は空白で区切られた語の数です（例：「Can you help me?」= 4語）
- 必ず${wordCountRule.min}語以上${wordCountRule.max}語以下にしてください
- この制約は絶対に守ってください

【ニュアンスの選択基準】
- ${characterRoles.character1}と${characterRoles.character2}の関係性を考慮
- オフィス・病院・学校などフォーマルな場面や、上司・医師・先生など上位の立場への発話 → 「礼儀正しい」
- 家庭・公園・旅行先などプライベートな場面や、友人・同僚・家族など対等/親しい関係 → 「カジュアル」または「砕けた」
- 場面と関係性を考慮して最適なニュアンスを選択してください

【出力】
以下のJSON形式で出力してください：
{
  "english": "生成された英文",
  "nuance": "選択されたニュアンス（カジュアル/砕けた/礼儀正しい）"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: `${initialAlphabet} から始まる英文を生成してください。単語数は必ず${wordCountRule.min}語から${wordCountRule.max}語の範囲内にしてください。`,
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

  const wordCount = countWords(parsed.english);
  if (wordCount < wordCountRule.min || wordCount > wordCountRule.max) {
    throw new Error(
      `Word count ${wordCount} is out of range ${wordCountRule.min}-${wordCountRule.max}`,
    );
  }

  return { english: parsed.english, nuance: parsed.nuance };
}

/**
 * 重複のない英文を生成（最大10回リトライ）
 */
async function generateUniqueEnglish(
  type: ProblemType,
  initialAlphabet: string,
  scene: string,
  genre: string,
  characterRoles: { character1: string; character2: string },
): Promise<{ english: string; nuance: string }> {
  const maxRetries = 10;

  // 1回だけDBアクセスして既存の英文を取得
  const existingEnglishTexts = await getExistingEnglishTexts(type, initialAlphabet);
  console.log(
    `[generateUniqueEnglish] Found ${existingEnglishTexts.size} existing English texts for ${type}/${initialAlphabet}`,
  );

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await generateEnglishSentence(
      type,
      initialAlphabet,
      scene,
      genre,
      characterRoles,
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
  return `あなたは英語学習アプリの出題担当です。以下の仕様を満たす JSON オブジェクトのみを返してください。
  ${characterRoles.character2}（男性）の日本語での返事をヒントに${characterRoles.character1}（女性）の英語台詞「${english}」の意味を当てるクイズを作成したいのです。

【提供された英文】
"${english}"

【出力フィールド】
- english, japaneseReply, options(配列), correctIndex, scenePrompt, speakers, interactionIntent。
  ※englishフィールドには上記の英文「${english}」をそのまま含めてください。

【会話デザイン】
- ${scene}で、${characterRoles.character1}（女性）が${characterRoles.character2}（男性）に対して「${english}」と言います。
- この英文「${english}」に対して${characterRoles.character2}（男性）が自然に返答する日本語台詞を japaneseReply フィールドに入れること。

【選択肢】
- options は日本語4文（全て自然な口語）。
- options[0] は正解の選択肢です。つまり「${english}」の正しい日本語訳です。日本語としての自然な言い回しにしてください。単語も日本語らしく訳すべし（例: 「platform」なら「プラットフォーム」ではなく「ホーム」）。
  - 悪い例: 「You should try this park.」→「この公園を試してみた方がいいよ。」
  - 良い例: 「You should try this park.」→「この公園、ぜひ行ってみてください。」
- options[0] は英文のフォーマルさ・カジュアルさ・丁寧さのレベルを日本語でも同等に保つこと。例：「Could you please...」→「〜していただけませんか」、「Can you...」→「〜してくれる？」、「Help me」→「手伝って」。
- options[1] は主要名詞を共有しつつ意図をすり替える誤答（断り・別案・勘違いなど）。
- options[2], options[3] 明らかな誤答。「${english}」とは無関係な日本語の台詞。
- correctIndex は常に 0。

【japaneseReply】
- japaneseReplyは、englishの日本語訳ではありません。englishに対する返答です。options[0]（「${english}」の日本語訳）に対する${characterRoles.character2}（男性）の返答です。
  - ${characterRoles.character2}（男性）が即座に返す自然で簡潔な口語文。日本人が実際に使う自然な台詞を生成してください。
  - japaneseReplyは返答なので、options[0]の内容と同じになることはありません。
- japaneseReplyを見ることでenglishがどんな英文なのか推測できるような文章にしてください。
  - 例えばjapaneseReplyで「はい、〇〇どうぞ」と返答することで「何かを要求するenglishなのだろうな」と推測できるように。
  - 悪い例: options[0]が「来週の会議のテーマは何だっけ？」だった場合に「うん、そのことね。」というjapaneseReplyは不適切。japaneseReplyからenglishが何なのか全く推測できない。
  - 良い例: options[0]が「ボールから目を離さないで。」だった場合に「うん、ボールに集中するね。」というjapaneseReplyは適切。japaneseReplyからenglishが何となく推測できる。
- 文頭には相槌や感動詞的な応答詞を付けてほしい。
  - 相槌や感動詞的な応答詞の例: 「うん」「そうだなぁ」「いいね」「ほら」「いや」「いいえ」「ああ」「そうだね」「そうですね」「わかりました」
  - 文の例: 「うん、〇〇しよう」「どうぞ、〇〇だよ」「いいね、〇〇だね」「いや、〇〇だと」「そうですね、〇〇ですものね」
- japaneseReplyは、englishをただ日本語訳しただけのようなオウム返しではダメです。
  - 悪い例: Let me share this. → ああ、それについて教えて。
  - 良い例: Let me share this. → うん、教えてくれる？

【重要】
- japaneseReplyは、englishの日本語訳ではありません。englishに対する返答の台詞を生成してください。
- options[0] には英文クイズの正解が入ります。「${english}」の正しい日本語訳を入れてください。
`;
}

async function generateProblem(input: GenerateRequest): Promise<GeneratedProblem> {
  ensureApiKey();

  // 1. LENGTH_POOLとINITIAL_ALPHABETSからランダム選択（リクエストで指定されていない場合）
  let type: ProblemType;
  let initialAlphabet: string;

  if (input.type) {
    type = mapProblemType(input.type);
    // typeが指定されている場合でも、initial_alphabetはランダム選択
    initialAlphabet = INITIAL_ALPHABETS[Math.floor(Math.random() * INITIAL_ALPHABETS.length)];
  } else {
    const selected = selectRandomTypeAndAlphabet();
    type = selected.type;
    initialAlphabet = selected.initialAlphabet;
  }

  const wordCountRule = WORD_COUNT_RULES[type];

  // ランダムにsceneとgenreを選択
  const sceneData = SCENE_POOL[Math.floor(Math.random() * SCENE_POOL.length)];
  const selectedRolePair = sceneData.roles[Math.floor(Math.random() * sceneData.roles.length)];
  const genre = GENRE_POOL[Math.floor(Math.random() * GENRE_POOL.length)];

  const scene = sceneData.place;
  const characterRoles = {
    character1: selectedRolePair[0],
    character2: selectedRolePair[1],
  };

  // 2. 重複のない英文を生成（ニュアンスはAIが自動選択）
  const { english, nuance } = await generateUniqueEnglish(
    type,
    initialAlphabet,
    scene,
    genre,
    characterRoles,
  );

  // 3. systemPromptを作成して、生成された英文を元に問題の詳細を作成
  const systemPrompt = createSystemPrompt(scene, genre, english, characterRoles);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `以下の英文を使って問題を作成してください。英文: "${english}"
        
この英文に対する日本語の返答、選択肢、scenePromptなどを生成してください。`,
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
    japaneseReply?: string;
    options: unknown;
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
    (typeof parsed.japanese !== 'string' && typeof parsed.japaneseReply !== 'string') ||
    !Array.isArray(parsed.options)
  ) {
    console.error('[problem/generate] Missing fields in response:', {
      hasEnglish: typeof parsed.english === 'string',
      hasJapanese: typeof parsed.japanese === 'string',
      hasJapaneseReply: typeof parsed.japaneseReply === 'string',
      hasOptions: Array.isArray(parsed.options),
      actualResponse: parsed,
    });
    throw new Error('Model response missing required fields');
  }

  const options = parsed.options.map((option: unknown) => String(option));

  const baseProblem = {
    type,
    initialAlphabet,
    english: parsed.english || english, // 生成された英文を使用
    japaneseReply: parsed.japaneseReply ?? parsed.japanese ?? '',
    options,
    correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : 0,
    nuance,
    genre,
    sceneId: scene,
    scenePrompt:
      parsed.scenePrompt ??
      `${characterRoles.character1}（女性）が、${scene}で${characterRoles.character2}（男性）に対して何か${genre}をする。${characterRoles.character2}がそれに応じて行動する。`,
    speakers: normalizeSpeakers(),
    characterRoles,
    interactionIntent: mapInteractionIntent(parsed.interactionIntent),
  };

  const wordCount = countWords(baseProblem.english);
  const problem: GeneratedProblem = {
    ...baseProblem,
    wordCount,
  };

  if (wordCount < wordCountRule.min || wordCount > wordCountRule.max) {
    console.warn(
      `[problem/generate] english word count ${wordCount} out of range ${wordCountRule.min}-${wordCountRule.max} for type ${type}.`,
    );
  }

  return shuffleProblem(problem);
}

function mapInteractionIntent(value?: string): InteractionIntent {
  if (!value) return 'request';
  const normalized = value.toLowerCase();
  switch (normalized) {
    case 'request':
    case 'question':
    case 'proposal':
    case 'opinion':
    case 'agreement':
    case 'info':
      return normalized;
    default:
      return 'request';
  }
}

function normalizeSpeakers(): GeneratedProblem['speakers'] {
  // 固定設定: Panel 1 (character1) = 女性が話す、Panel 2 (character2) = 男性が応じる
  return {
    character1: 'female', // 1コマ目：女性がお願い・提案
    character2: 'male', // 2コマ目：男性が応じる
  };
}

function shuffleProblem(problem: GeneratedProblem): GeneratedProblem {
  const zipped = problem.options.map((option, index) => ({ option, index }));
  for (let i = zipped.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
  }

  const shuffledOptions = zipped.map((item) => item.option);
  const newCorrectIndex = zipped.findIndex((item) => item.index === problem.correctIndex);

  return {
    ...problem,
    options: shuffledOptions,
    correctIndex: newCorrectIndex === -1 ? 0 : newCorrectIndex,
  };
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

    const imagePrompt = `実写風の2コマ漫画。
縦に2コマ。
上下のコマの間に20ピクセルの白い境界線。
上下のコマの高さは完全に同じです。

【場所】
${problem.sceneId}

【登場人物】
${problem.characterRoles.character1}（女性）
${problem.characterRoles.character2}（男性）

【1コマ目】
${problem.characterRoles.character1}（女性）が「${problem.english}」と言っている。

【2コマ目】
それを聞いた${problem.characterRoles.character2}（男性）が「${problem.japaneseReply}」と反応した。

【備考】
台詞に合ったジェスチャーと表情を描写してください。
漫画ですが、吹き出し・台詞はなし。自然で生成AIっぽくないテイスト。`;

    // 一意のproblemId生成（タイムスタンプベース）
    const problemId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log('[problem/generate] 🎯 ステップ1: アセット生成開始');

    // skipSaveが true の場合はBase64で返す（R2アップロードなし）
    if (body.skipSave) {
      console.log('[problem/generate] 🧪 テストモード: Base64アセット生成');

      try {
        // 並列でアセット生成（Base64形式）
        const assetPromises: Promise<string>[] = [
          generateSpeech(problem.english, problem.speakers.character1),
          generateSpeech(problem.japaneseReply || problem.english, problem.speakers.character2),
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
            type: problem.type,
            english: problem.english,
            japaneseReply: problem.japaneseReply,
            options: problem.options,
            correctIndex: problem.correctIndex,
            nuance: problem.nuance,
            genre: problem.genre,
            scenePrompt: problem.scenePrompt,
            sceneId: problem.sceneId,
            speakers: problem.speakers,
            characterRoles: problem.characterRoles,
            wordCount: problem.wordCount,
            interactionIntent: problem.interactionIntent,
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
        generateSpeechBuffer(problem.english, problem.speakers.character1),
        generateSpeechBuffer(problem.japaneseReply || problem.english, problem.speakers.character2),
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
        uploadAudioToR2(englishAudioBuffer, problemId, 'en', problem.speakers.character1),
        uploadAudioToR2(japaneseAudioBuffer, problemId, 'ja', problem.speakers.character2),
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
      composite: compositeScene,
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
            type: problem.type,
            initialAlphabet: problem.initialAlphabet,
            english: problem.english,
            japaneseReply: problem.japaneseReply,
            options: problem.options,
            correctIndex: problem.correctIndex,
            sceneId: problem.sceneId,
            scenePrompt: problem.scenePrompt,
            nuance: problem.nuance,
            genre: problem.genre,
            patternGroup: undefined,
            wordCount: problem.wordCount,
            interactionIntent: problem.interactionIntent,
            speakers: problem.speakers,
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
      composite: compositeScene,
      imagePrompt: imagePrompt, // 常に画像プロンプトを含める
      audio: {
        english: englishAudio,
        japanese: japaneseAudio,
      },
    } as const;

    return NextResponse.json({
      problem: {
        type: problem.type,
        english: problem.english,
        japaneseReply: problem.japaneseReply,
        options: problem.options,
        correctIndex: problem.correctIndex,
        nuance: problem.nuance,
        genre: problem.genre,
        scenePrompt: problem.scenePrompt,
        speakers: problem.speakers,
        characterRoles: problem.characterRoles,
        wordCount: problem.wordCount,
        interactionIntent: problem.interactionIntent,
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
