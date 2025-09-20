import OpenAI from 'openai';
import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ProblemType = 'short' | 'medium' | 'long';

type GenerateRequest = {
  type?: ProblemType;
  nuance?: string;
  genre?: string;
};

type GeneratedProblem = {
  type: ProblemType;
  english: string;
  japaneseReply: string;
  options: string[];
  correctIndex: number;
  nuance: string;
  genre: string;
  scenePrompt: string;
  speakers: {
    sceneA: 'male' | 'female' | 'neutral';
    sceneB: 'male' | 'female' | 'neutral';
  };
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

  const systemPrompt = `あなたは英語学習アプリの出題担当です。以下の条件でJSONのみを出力してください。
- JSON object のみ。フィールドは英語本文(english)、日本語での返答セリフ(japaneseReply)、4つの日本語選択肢(options)、正解インデックス(correctIndex)、画像プロンプト(scenePrompt)、話者情報speakers。
- english は家庭や職場、近所などの日常生活に即した短文（ライトなお願い、会話のフレーズなど）。敬語一辺倒ではなく、カジュアル〜丁寧の幅を持たせ、sceneId=${scene.id}（${scene.description}）の状況に合う内容にする。
- japaneseReply は、場面Bで自然に返す日本語。カジュアル／友人／家族の距離感を意識し、英語と同じ表現をそのまま訳さない。ニュアンスや言い回しを変えてもよい。
- options は4つの日本語文。index 0 は英語文の正しい意味。index 1 は英語文と近いがニュアンスが少し違う・迷いやすい文。index 2 と 3 は明らかに意味が異なる文だが自然な会話文にする。丁寧さや一人称・二人称の使い分けを混ぜて紛らわせる。
- correctIndex は 0-based。
- scenePrompt は DALL·E 用に英語で 150 文字以内。指定された場面 (sceneId=${scene.id}) の説明「${scene.description}」に沿って、多様な短文が生まれるよう毎回アクションを変える。塩や食器の受け渡しに固定しない。
- scenePrompt では、不要な字幕やテキストオーバーレイ、看板など文字要素は一切描写しない。同一シーンでもシーンA/Bで異なるアングル・瞬間を確保すること。
- 画像は、正しい選択肢の内容・ニュアンスが視覚的に明確にわかるようにし、他の選択肢と紛らわしい構図は避ける。正解と直接関係しない動作や家具などは控える。
- scenePrompt の中に、SceneA は「まだ依頼が受け入れられておらず、依頼者が手を伸ばしたり視線を向けているがアイテムは手にしていない状態」、SceneB は「日本語の返答後で、アイテムを手渡したりアクションが進行した直後」であると明示する。
- speakers は { sceneA: "male|female|neutral", sceneB: "male|female|neutral" } の形式で、scenePrompt に登場する人物の性別・雰囲気と整合させる。ケース全体で男性の話者が過半数になるよう意識し、少なくとも片方は男性になるように調整する。
- 例: english="Can you grab my phone from the sofa?" → japaneseReply="いいよ、そこにあるやつね。" / english="Mind helping me fold this blanket?" → japaneseReply="もちろん、一緒にやろう。" / english="Could you rinse these cups?" → japaneseReply="了解、今すぐ流しに持っていくよ。" のように、日常会話として自然で柔らかい対応をすること。
- タイプ: ${type}
- ニュアンス: ${nuance}
- ジャンル: ${genre}`;

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
  };

  let parsed: ModelResponse;
  try {
    parsed = JSON.parse(jsonText) as ModelResponse;
  } catch (err) {
    console.error('[problem/generate] JSON parse error', err, jsonText);
    throw new Error('Failed to parse model response as JSON');
  }

  if (
    typeof parsed.english !== 'string' ||
    (typeof parsed.japanese !== 'string' && typeof parsed.japaneseReply !== 'string') ||
    !Array.isArray(parsed.options)
  ) {
    throw new Error('Model response missing required fields');
  }

  const options = parsed.options.map((option: unknown) => String(option));

  const problem: GeneratedProblem = {
    type,
    english: parsed.english,
    japaneseReply: parsed.japaneseReply ?? parsed.japanese ?? '',
    options,
    correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : 0,
    nuance,
    genre,
    scenePrompt: parsed.scenePrompt ?? `${genre} scene with polite tone`,
    speakers: normalizeSpeakers({
      sceneA: mapSpeaker(parsed.speakers?.sceneA),
      sceneB: mapSpeaker(parsed.speakers?.sceneB),
    }),
  };

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

function normalizeSpeakers(
  speakers: GeneratedProblem['speakers'],
): GeneratedProblem['speakers'] {
  let { sceneA, sceneB } = speakers;
  const randomGender = () => (Math.random() < 0.5 ? 'male' : 'female') as 'male' | 'female';

  if (sceneA === 'neutral' && sceneB === 'neutral') {
    sceneA = randomGender();
    sceneB = sceneA === 'male' ? 'female' : 'male';
  } else if (sceneA === 'neutral') {
    sceneA = sceneB === 'neutral' ? randomGender() : sceneB;
  } else if (sceneB === 'neutral') {
    sceneB = sceneA;
  }

  if (sceneA !== 'male' && sceneB !== 'male') {
    if (Math.random() < 0.5) {
      sceneA = 'male';
    } else {
      sceneB = 'male';
    }
  }

  return { sceneA, sceneB };
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

async function generateImage(prompt: string) {
  ensureApiKey();
  const image = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
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
      return 'luna';
    default:
      return 'alloy';
  }
}

export async function POST(req: Request) {
  try {
    const body: GenerateRequest = await req.json().catch(() => ({}));
    const problem = await generateProblem(body);

    const debugMode = process.env.DEBUG_MODE === 'true';

    let sceneA: string;
    let sceneB: string;

    if (debugMode) {
      sceneA = `${problem.scenePrompt} [Scene A: request moment, hands empty, item not yet handed over]`;
      sceneB = `${problem.scenePrompt} [Scene B: action carried out after Japanese reply, item clearly visible]`;
    } else {
      sceneA = await generateImage(
        `${problem.scenePrompt}. Scene A: right before the English line is spoken, the requester is clearly making the correct request with body language and focus on the relevant item, hands empty, item not yet handed over. No text, no subtitles, no speech bubbles. Avoid unrelated actions that could imply other options.`,
      );
      sceneB = await generateImage(
        `${problem.scenePrompt}. Scene B: immediately after the Japanese reply, only the correct action is being carried out (e.g., item being passed, beverage being poured), clearly showing the requested item in focus. No text, no subtitles, no speech bubbles. Avoid hints for incorrect options.`,
      );
    }

    const [englishAudio, japaneseAudio] = await Promise.all([
      generateSpeech(problem.english, problem.speakers.sceneA),
      generateSpeech(problem.japaneseReply || problem.english, problem.speakers.sceneB),
    ]);

    return NextResponse.json({
      problem,
      assets: {
        sceneA,
        sceneB,
        audio: {
          english: englishAudio,
          japanese: japaneseAudio,
        },
        debug: debugMode,
      },
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
