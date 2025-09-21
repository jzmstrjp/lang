import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/audio-utils';

import type {
  InteractionIntent as PrismaInteractionIntent,
  ProblemType as PrismaProblemType,
} from '@prisma/client';

import { saveGeneratedProblem } from '@/lib/problem-storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ProblemType = PrismaProblemType;

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
  wordCount: number;
  interactionIntent: InteractionIntent;
};

const WORD_COUNT_RULES: Record<ProblemType, { min: number; max: number }> = {
  short: { min: 2, max: 5 },
  medium: { min: 6, max: 10 },
  long: { min: 11, max: 20 },
};

const GENRE_POOL = ['依頼', '質問', '提案', '意見', '情報共有'] as const;
const SCENE_POOL = [
  '家庭',
  'オフィス',
  '公園',
  '旅行先',
  '学校',
  '病院',
  '駅',
  '飲食店',
  'スポーツ施設',
  'ショッピングモール',
  '結婚式',
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

async function generateProblem(input: GenerateRequest): Promise<GeneratedProblem> {
  ensureApiKey();

  const type = mapProblemType(input.type);
  const nuance = input.nuance ?? 'polite';
  const wordCountRule = WORD_COUNT_RULES[type];

  // ランダムにsceneとgenreを選択
  const scene = SCENE_POOL[Math.floor(Math.random() * SCENE_POOL.length)];
  const genre = GENRE_POOL[Math.floor(Math.random() * GENRE_POOL.length)];

  const systemPrompt = `あなたは英語学習アプリの出題担当です。以下の仕様を満たす JSON オブジェクトのみを返してください。
  男性の日本語台詞をヒントに女性の英語台詞の意味を当てるクイズを作成したいのです。

【重要：単語数制約】
- english フィールドは必ず ${wordCountRule.min}語から${wordCountRule.max}語の範囲内にしてください。
- 単語数は空白で区切られた語の数です（例：「Can you help me?」= 4語）。
- この制約は絶対に守ってください。範囲外の場合は不適切な回答とみなされます。

【出力フィールド】
- english, japaneseReply, options(配列), correctIndex, scenePrompt, speakers, interactionIntent。

【会話デザイン】
- ${scene}で、女性が男性に対して英語で何か${genre}をする。具体的に何なのかはあなたがランダムに決めてください。ただし場面にあったものにしてください。男性がそれに応じて日本語で返答する。
- 女性の英語台詞をenglishフィールドに入れる。男性の日本語台詞をjapaneseReplyフィールドに入れる。
- 場面に合わせてenglishは丁寧/カジュアル/ぶっきらぼうなどのニュアンスを表現すること。

【japaneseReply】
- japaneseReplyは、englishを日本語訳した文章ではありません。japaneseReplyは、englishに対する返答です。
- japaneseReplyは、女性の台詞（english）に対して男性が即座に返す自然で簡潔な口語文。日本人が実際に使う自然な表現にすること。
- japaneseReplyを見れば、englishがどんな英文なのか推測できるように匂わせるべし。ただし、完全なオウム返しにはならないように。
  - 例えば「はい、〇〇どうぞ」と返答することで「何かを要求するenglishなのだろうな」と推測できるように。
  - 悪い例: 「Can you pass me that?」というenglishに対して「うん、そのことね。」というjapaneseReply。→japaneseReplyからenglishが何なのか全く推測できない。
- 「うん、〇〇しよう」「いいね、〇〇だね」「いや、〇〇だと」「そうですね、〇〇ですものね」みたいに「うん」「いや」「いいえ」「ああ」「そうだね」「そうですね」「わかりました」とかを文頭に含めてほしい。

【scenePrompt】（文字列）
- english と japaneseReply の台詞の内容にぴったりな2コマ漫画のストーリーを文字列で記述してほしい。
- ${scene}で何が起きていて、女性が男性に対して何を${genre}したのか想像して、自然なストーリーにしてほしい。
- 2コマ漫画で描写できるような、ごく短い完結なストーリーにしてほしい。
- この文を元に画像生成プロンプトを作成するので、具体的に詳細に描写してほしい。
- 【1コマ目】【2コマ目】という見出しを使って、各コマで起きていることや情景を明確に言語化した文字列として出力してほしい。
- 1コマ目の説明にはenglishを、2コマ目の説明にはjapaneseReplyを必ず引用すること。
- 1コマ目ではまだjapaneseReplyの内容は行動に移さないこと。
- 2コマ目ではjapaneseReplyでやろうと言った内容を行動に移すこと。
  - 悪い例: セリフが「ベンチに座ろう」なのに「ベンチに向かった」と表現する
  - 良い例: 台詞が「ベンチに座ろう」だから「ベンチに座った」と表現する

【選択肢】
- options は日本語4文（全てユニークで自然な口語）。
- options[0] は english の正しい訳。英文のフォーマルさ・カジュアルさ・丁寧さのレベルを日本語でも同等に保つこと。例：「Could you please...」→「〜していただけませんか」、「Can you...」→「〜してくれる？」、「Help me」→「手伝って」。日本人ならこの場面でこう言うのが自然だろうな、って感じの訳。
- options[1] は主要名詞を共有しつつ意図をすり替える誤答（断り・別案・勘違いなど）。
- options[2], options[3] は動作や対象を変えた誤答。japaneseReply に引きずられず、英文の意味に基づいて作る。
- correctIndex は常に 0。
`;
  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    input: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `英語フレーズと選択肢を生成してください。英語フレーズは必ず${wordCountRule.min}語から${wordCountRule.max}語の範囲内で作成してください。`,
      },
    ],
  });

  const rawText = response.output_text ?? '';

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
    throw new Error('Model response missing required fields');
  }

  const options = parsed.options.map((option: unknown) => String(option));

  const baseProblem = {
    type,
    english: parsed.english,
    japaneseReply: parsed.japaneseReply ?? parsed.japanese ?? '',
    options,
    correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : 0,
    nuance,
    genre,
    sceneId: scene,
    scenePrompt:
      parsed.scenePrompt ??
      `女性が、${scene}で男性に対して何か${genre}をする。男性がそれに応じて行動する。`,
    speakers: normalizeSpeakers(),
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

function mapSpeaker(value?: string): 'male' | 'female' | 'neutral' {
  if (!value) return 'neutral';
  const normalized = value.toLowerCase();
  if (normalized.includes('male') || normalized.includes('man') || normalized.includes('boy')) {
    return 'male';
  }
  if (
    normalized.includes('female') ||
    normalized.includes('woman') ||
    normalized.includes('girl')
  ) {
    return 'female';
  }
  return 'neutral';
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

    const imagePrompt = `実写風の2コマ漫画。縦構図、パネル間に白い境界線。

${problem.scenePrompt}

台詞に合ったジェスチャーと表情を描写してください。

吹き出し・文字なし。視覚的表現のみ。自然で生成AIっぽくないテイスト。`;

    // リクエストパラメータで画像生成を制御
    let compositeScene = null;

    if (!body.withoutPicture) {
      try {
        compositeScene = await generateImage(imagePrompt);
      } catch (imageError) {
        console.error('[problem/generate] image generation failed', imageError);
        // 画像生成に失敗してもエラーにしない
      }
    }

    const [englishAudio, japaneseAudio] = await Promise.all([
      generateSpeech(problem.english, problem.speakers.character1),
      generateSpeech(problem.japaneseReply || problem.english, problem.speakers.character2),
    ]);

    const persistAssets = {
      composite: compositeScene || null,
      audio: {
        english: englishAudio,
        japanese: japaneseAudio,
      },
    };

    let persisted = null;
    if (!body.skipSave) {
      try {
        persisted = await saveGeneratedProblem({
          problem: {
            type: problem.type,
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
      } catch (persistError) {
        console.error('[problem/generate] persist error', persistError);
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
