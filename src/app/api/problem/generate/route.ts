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

type InteractionIntent = 'request' | 'question' | 'opinion' | 'agreement' | 'info';

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
  wordCount: number;
  interactionIntent: InteractionIntent;
};

const WORD_COUNT_RULES: Record<ProblemType, { min: number; max: number; label: string }> = {
  short: { min: 2, max: 4, label: '超短文 (2〜4語)' },
  medium: { min: 6, max: 10, label: '中くらいの依頼文 (6〜10語)' },
  long: { min: 11, max: 15, label: '長めの依頼文 (11〜15語)' },
};

const TYPE_GUIDANCE: Record<ProblemType, string> = {
  short:
    '短文タイプ: 2〜4語の超短い口語フレーズ（例: Need that mug?, Mind if I sit?）にし、節の入れ子や長い修飾は避ける。瞬時の反応や軽い確認に焦点を当てる。',
  medium:
    '中くらいタイプ: 依頼や意見に理由・条件をひと言添えてよいが、関係代名詞や分詞構文は最小限にし、読みやすさを優先する。',
  long: '長文タイプ: 11〜15語を活かし、and / because / if / when などで節をつなぐ複合文にしてよい。自然な口語的な言い回しや軽い脱文法も許容する。',
};

const TYPE_EXAMPLES: Record<ProblemType, string> = {
  short:
    '例(short): english="Orange mug, please." → options[0]="そのオレンジのマグちょうだい。" / japaneseReply="了解、テーブルの右側にあるやつね。"',
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

  const systemPrompt = `あなたは英語学習アプリの出題担当です。以下の制約を守った JSON オブジェクトのみを出力してください。
- 必須フィールド: english, japaneseReply, options(配列), correctIndex, scenePrompt, speakers, interactionIntent。
- english: SceneA が発話する日常会話。状況が分かる一文にし、${TYPE_GUIDANCE[type]} ${TYPE_EXAMPLES[type]} 先頭に "Can you" / "Could you" を置かず、同じ言い出しをテンプレ化しない。依頼・質問・感想などを命令文や平叙文、"Would you mind"、"Any chance"、"I was thinking" など多様な構文で自然に表現する。
- 語数: ${wordCountRule.min}〜${wordCountRule.max} 語（${wordCountRule.label}）。間投詞や呼びかけで水増ししない。
- interactionIntent: 'request' | 'question' | 'opinion' | 'agreement' | 'info' から実際の意図に最も合うものを選ぶ。
- japaneseReply: SceneB の自然な返答。english に出てくる主要な名詞・動作を必ず含め、質問なら回答、依頼なら可否と理由/補足を伝える。日常会話で違和感のない口語表現（例: 「〜するね」「〜してくれる？」など）を使い、直訳調の硬い言い回し（例: 「〜を渡します」など）は避ける。追加する状況ヒントは一言にとどめ、options[0] の本文を繰り返さない。
- options: 日本語文4つ（全てユニーク）。全て日常会話として自然な口語表現にする。index0 は english の忠実な訳で情報の追加・削除をしないが、丁寧すぎる直訳を避け、英語のニュアンスに合う自然な言い回しに整える。index1 は主要名詞を共有しつつ意図を変える誤答（断り・別案など）。index2 と index3 は動作や対象を変えた誤答。英語の意味を基準に作成し、japaneseReply の内容に引きずられない。
- correctIndex は常に 0。
- scenePrompt: sceneId=${scene.id}（${scene.description}）の情景を英語で最大150文字にまとめる。SceneA/B の人物とキーになる物体を描写しつつ、命令口調・カメラ指定・テキスト挿入の指示は避け、ベースとなる環境描写だけを書く。
- speakers: sceneA/sceneB を male/female/neutral で返す。少なくとも片方は male。情報がない場合は自然に推測し、両方 neutral になりそうなら片方を male にする。
- 出力は JSON 1 つのみ。改行や解説、コードフェンスは禁止。english ↔ options[0] ↔ japaneseReply の論理整合性を確認し、必要なら修正してから返答する。
- タイプ: ${type} / ニュアンス: ${nuance} / ジャンル: ${genre}`;

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
    scenePrompt: parsed.scenePrompt ?? `${genre} scene with polite tone`,
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
      return 'coral';
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
        `${problem.scenePrompt}. Scene A: right before the English line is spoken, the requester is clearly making the correct request with body language and focus on the relevant item, hands empty, item not yet handed over. Photorealistic style, consistent tone with Scene B. No text, no subtitles, no speech bubbles. Avoid unrelated actions that could imply other options.`,
      );
      sceneB = await generateImage(
        `${problem.scenePrompt}. Scene B: immediately after the Japanese reply, only the correct action is being carried out (e.g., item being passed, beverage being poured), clearly showing the requested item in focus. Photorealistic style, consistent tone with Scene A. No text, no subtitles, no speech bubbles. Avoid hints for incorrect options.`,
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
