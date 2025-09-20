import OpenAI from 'openai';
import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';

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
  genre?: string;
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
    sceneA: 'male' | 'female' | 'neutral';
    sceneB: 'male' | 'female' | 'neutral';
  };
  wordCount: number;
  interactionIntent: InteractionIntent;
};

const WORD_COUNT_RULES: Record<ProblemType, { min: number; max: number; label: string }> = {
  short: { min: 2, max: 5, label: '短い会話フレーズ (2〜5語)' },
  medium: { min: 6, max: 10, label: '中くらいの会話文 (6〜10語)' },
  long: { min: 11, max: 20, label: '長めの会話文 (11〜20語)' },
};

const TYPE_GUIDANCE: Record<ProblemType, string> = {
  short:
    '短文タイプ: 2〜5語で完結した口語文にする。依頼・質問・提案・意見など多様な会話パターンを使い、単なる名詞句や命令文だけにならないようにする。',
  medium:
    '中くらいタイプ: 6〜10語で依頼・質問・提案・意見・情報共有など様々な会話意図に理由・条件をひと言添えてよいが、関係代名詞や分詞構文は最小限にし、読みやすさを優先する。',
  long: '長文タイプ: 11〜20語を活かし、and / because / if / when などで節をつなぐ複合文にしてよい。依頼だけでなく質問・提案・意見・情報共有など多様な会話意図を含める。自然な口語的な言い回しや軽い脱文法も許容する。',
};

const TYPE_EXAMPLES: Record<ProblemType, string> = {
  short:
    '例(short): english="Could you grab the orange mug?" → options[0]="そのオレンジのマグ取ってくれる？" / japaneseReply="いいよ、テーブルの右側にあるやつでしょ。"',
  medium:
    '例(medium): english="Mind watching the soup while I get the door?" → options[0]="私が玄関に出ている間、お鍋を見ていてくれる？" / japaneseReply="いいよ、吹きこぼれに気をつけるね。"',
  long: '例(long): english="I thought we could invite Sam since he fixed the projector last time, what do you think?" → options[0]="この前プロジェクターを直してくれたサムを招待したらどうかな？" / japaneseReply="賛成、彼もまた手伝ってくれそう。"',
};

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
  const scenePool = [
    {
      id: 'kitchen',
      description:
        'A cozy kitchen where family members are preparing or cleaning up a meal together. Countertops, sink, or stove may be visible.',
    },
    {
      id: 'living_room',
      description:
        'A living room with a sofa, coffee table, TV stand, or bookshelves where friends or family relax, watch TV, or chat.',
    },
    {
      id: 'dining_room',
      description:
        'A dining room with a table, chairs, and dishes laid out; people might be setting the table, serving food, or clearing up after eating.',
    },
    {
      id: 'home_office',
      description:
        'A home office or study corner with a desk, laptop, papers, and stationery used for remote work or study at home.',
    },
    {
      id: 'entryway',
      description:
        'An entryway or hallway with shoes, coats, keys, or shopping bags, capturing people coming or going.',
    },
    {
      id: 'laundry_room',
      description:
        'A laundry or utility area with washing machine, dryer, laundry baskets, detergent, and household cleaning tools.',
    },
    {
      id: 'balcony',
      description:
        'A balcony or outdoor patio with plants, small furniture, and light chores like watering plants or shaking blankets.',
    },
    {
      id: 'kids_room',
      description:
        'A child’s room or play area with toys, books, or art supplies where a parent and child interact.',
    },
    {
      id: 'garage',
      description:
        'A garage or storage space with tools, boxes, or bicycles where someone might ask for help moving or finding items.',
    },
    {
      id: 'neighborhood',
      description:
        'A residential neighborhood street, front yard, or sidewalk where neighbors or family members interact outdoors.',
    },
    {
      id: 'grocery_store',
      description:
        'A small grocery or convenience store aisle with shelves, baskets, and chilled cases where people shop together.',
    },
    {
      id: 'park',
      description:
        'A nearby park or playground with benches, paths, or exercise equipment, capturing casual outdoor requests.',
    },
  ];

  const scene = scenePool[Math.floor(Math.random() * scenePool.length)];
  const genre = input.genre ?? scene.id;

  const systemPrompt = `あなたは英語学習アプリの出題担当です。以下の仕様を満たす JSON オブジェクトのみを返してください。

【出力フィールド】
- english, japaneseReply, options(配列), correctIndex, scenePrompt, speakers, interactionIntent。

【会話デザイン】
- SceneA は女性、SceneB は男性として設定する。女性（SceneA）が男性（SceneB）に対して依頼・提案・質問をし、男性（SceneB）がそれに応じる構造にする。
- 女性（SceneA）が scenePrompt に沿った状況で自然に話し始める。${TYPE_GUIDANCE[type]}
- ${TYPE_EXAMPLES[type]}
- ${wordCountRule.min}〜${wordCountRule.max} 語（${wordCountRule.label}）。水増しのための間投詞や名前呼びを避け、文として完結させる。
- 依頼・質問・意見などの意図を scenePrompt と整合させ、'request' | 'question' | 'opinion' | 'agreement' | 'info' から interactionIntent を選ぶ。
- 丁寧/カジュアル/ぶっきらぼうなど nuance の指示があれば、それに合う語調・モーダル・語尾を採用する。同じ出題内で毎回同じ書き出しにならないようバリエーションをつける（"Can you" などは可だが連続使用は避ける）。

【日本語返信】
- japaneseReply は男性（SceneB）が女性（SceneA）の依頼・提案・質問に対して即座に返す自然で簡潔な口語文。日本人が実際に使う自然な表現にすること。
- 依頼への返事は対象物を含めて「はい、○○どうぞ」「うん、○○いいよ」「分かった、○○ね」など、クイズのヒントとなる適度な情報を含む自然な表現にする。
- 質問への返事は具体的かつ簡潔に。意見への返事は同意/反論を自然に表現する。
- 参考例: "リモコンを渡してくれる？" → "はい、リモコンどうぞ" / "おもちゃを片付けるの手伝ってくれる？" → "うん、おもちゃ一緒に片付けよう" / "今日は遊園地に行きたいなぁ" → "いいね、遊園地行こう！" / "塩を取ってくれる？" → "はい、塩これ" / "窓を開けてくれる？" → "分かった、窓開けるね"
- 絶対に避けるべき表現: 「〜してあげる」「その○○を〜する」など、相手の発言をそのまま長々と繰り返す不自然な日本語。ただし、対象物の名詞は学習のヒントとして適度に含める。

【選択肢】
- options は日本語4文（全てユニークで自然な口語）。
- options[0] は english の忠実な訳。情報の追加・削除はせず語調だけ自然に整える。
- options[1] は主要名詞を共有しつつ意図をすり替える誤答（断り・別案・勘違いなど）。
- options[2], options[3] は動作や対象を変えた誤答。japaneseReply に引きずられず、英文の意味に基づいて作る。
- correctIndex は常に 0。

【シーン設定】
- scenePrompt: sceneId=${scene.id}（${scene.description}）の状況を 'who=...; what=...; where=...; when=...; key_objects=...; camera=...' 形式で150〜220文字にまとめる。曖昧語を避け、具体的な人物像・行動・時間帯・主要物体・撮影距離を記述する。
- speakers: SceneA/SceneB を male/female/neutral で返す。少なくとも片方は male。情報が薄い場合は自然に補完し、両方 neutral になりそうなら片方を male にする。

【厳守事項】
- 出力は JSON 1 つのみ。改行や凡例、コードフェンスは禁止。
- english ↔ options[0] ↔ japaneseReply の論理を必ずそろえ、矛盾があれば修正してから返答する。
- タイプ: ${type} / ニュアンス: ${nuance} / ジャンル: ${genre}`;
  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    temperature: 0.9,
    input: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: '英語フレーズと選択肢を生成してください。',
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
      sceneA?: string;
      sceneB?: string;
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
    sceneId: scene.id,
    scenePrompt:
      parsed.scenePrompt ??
      `who=family member in their ${genre} home; what=politely requesting help handling ${genre}-related task; where=cozy ${scene.description.toLowerCase()}; when=early evening with warm indoor lighting; key_objects=tableware, requested item clearly visible; camera=medium shot at eye level capturing both speaker and target object`,
    speakers: normalizeSpeakers({
      sceneA: mapSpeaker(parsed.speakers?.sceneA),
      sceneB: mapSpeaker(parsed.speakers?.sceneB),
    }),
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
    case 'opinion':
    case 'agreement':
    case 'info':
      return normalized;
    default:
      return 'request';
  }
}

function normalizeSpeakers(speakers: GeneratedProblem['speakers']): GeneratedProblem['speakers'] {
  // 固定設定: Panel 1 (sceneA) = 女性が話す、Panel 2 (sceneB) = 男性が応じる
  return {
    sceneA: 'female', // 1コマ目：女性がお願い・提案
    sceneB: 'male', // 2コマ目：男性が応じる
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

async function generateSpeech(input: string, speaker: 'male' | 'female' | 'neutral') {
  ensureApiKey();

  const voice = speakerToVoice(speaker);

  const result = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input,
  });

  const arrayBuffer = await result.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

function speakerToVoice(speaker: 'male' | 'female' | 'neutral'): string {
  switch (speaker) {
    case 'male':
      return 'verse';
    case 'female':
      return 'coral';
    default:
      return 'alloy';
  }
}

export async function POST(req: Request) {
  try {
    const body: GenerateRequest = await req.json().catch(() => ({}));
    const problem = await generateProblem(body);

    const baseSceneFacts = `Use these scene facts exactly: ${problem.scenePrompt}.`;
    const storyNarrative = `Story flow: In Panel 1, ${problem.speakers.sceneA === 'male' ? 'a man' : problem.speakers.sceneA === 'female' ? 'a woman' : 'a person'} says to ${problem.speakers.sceneB === 'male' ? 'a man' : problem.speakers.sceneB === 'female' ? 'a woman' : 'another person'}: "${problem.english}". In Panel 2, responding to this request, ${problem.speakers.sceneB === 'male' ? 'the man' : problem.speakers.sceneB === 'female' ? 'the woman' : 'the person'} replies "${problem.japaneseReply}" and takes the corresponding action.`;
    const compositeScene = await generateImage(
      `Create a single illustration arranged as a two-panel comic strip stacked vertically in portrait orientation with a clear white border/gutter between the panels. Each panel must have exactly equal height - divide the image into two perfectly symmetrical halves with a distinct white gap separating them. Ensure there is always a visible white space between the top and bottom panels to clearly distinguish them as separate scenes. ${storyNarrative} ${baseSceneFacts} Panel 1 (top half): Show the moment when ${problem.speakers.sceneA === 'male' ? 'the man' : problem.speakers.sceneA === 'female' ? 'the woman' : 'the person'} is making the request "${problem.english}" through clear visual gestures and expressions, while the requested action has not yet been fulfilled. Panel 2 (bottom half): Show ${problem.speakers.sceneB === 'male' ? 'the man' : problem.speakers.sceneB === 'female' ? 'the woman' : 'the person'} actively responding with "${problem.japaneseReply}" by performing the requested action or providing what was asked for. Maintain the same characters, wardrobe, and setting across both panels. Ensure both panels are identical in height and proportions with a clear white separator between them. This is a two-panel comic strip, but DO NOT include any dialogue, speech bubbles, or text in the image - express everything through visual actions and expressions only. Photorealistic rendering, consistent household lighting, gentle comic framing, and absolutely no speech bubbles or text anywhere.`,
    );

    const [englishAudio, japaneseAudio] = await Promise.all([
      generateSpeech(problem.english, problem.speakers.sceneA),
      generateSpeech(problem.japaneseReply || problem.english, problem.speakers.sceneB),
    ]);

    const persistAssets = {
      composite: compositeScene,
      audio: {
        english: englishAudio,
        japanese: japaneseAudio,
      },
    };

    let persisted = null;
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

    if (persisted) {
      return NextResponse.json(persisted);
    }

    const responseAssets = {
      sceneA: compositeScene,
      sceneB: compositeScene,
      composite: compositeScene,
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
