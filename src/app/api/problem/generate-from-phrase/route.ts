import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { TEXT_MODEL } from '@/const';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import {
  buildEnglishSentenceOnlyPrompt,
  type Voice,
  type How,
} from '@/lib/english-sentence-prompt';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GENERATE_COUNT = 3;

async function generateOne(params: {
  phrase: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  additionalInstruction: string;
  usedSentences: string[];
}): Promise<{
  englishSentence: string;
  japaneseSentence: string;
  situation: string;
  prompt: string;
} | null> {
  const prompt = buildEnglishSentenceOnlyPrompt({
    ...params,
    category: 'casual',
    includeJapaneseSentence: true,
  });

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message.content?.trim() ?? '';
  const jsonMatch = raw.match(/```json\n([\s\S]*?)```/);
  if (!jsonMatch?.[1]) return null;

  const parsed = JSON.parse(jsonMatch[1]) as {
    englishSentence: string;
    japaneseSentence: string;
    situation: string;
  };

  return {
    englishSentence: parsed.englishSentence,
    japaneseSentence: parsed.japaneseSentence,
    situation: parsed.situation,
    prompt,
  };
}

export async function POST(req: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      phrase?: string;
      additionalInstruction?: string;
      type?: ProblemLength;
      voice?: Voice;
      how?: How;
    };

    const phrase = body.phrase?.trim();
    if (!phrase) {
      return NextResponse.json({ error: 'phrase は必須です。' }, { status: 400 });
    }

    const type = body.type ?? 'short';
    const rule = WORD_COUNT_RULES[type];
    if (!rule) {
      return NextResponse.json({ error: `無効な type: ${type}` }, { status: 400 });
    }

    const voice = body.voice ?? 'male';
    const how = body.how ?? '対面';
    const additionalInstruction = body.additionalInstruction?.trim() ?? '';

    // GENERATE_COUNT件を順番に生成（usedSentencesで被りを防ぐ）
    const results: {
      englishSentence: string;
      japaneseSentence: string;
      situation: string;
      prompt: string;
    }[] = [];
    for (let i = 0; i < GENERATE_COUNT; i++) {
      const usedSentences = results.map((r) => r.englishSentence);
      const result = await generateOne({
        phrase,
        voice,
        how,
        rule,
        additionalInstruction,
        usedSentences,
      });
      if (result) results.push(result);
    }

    return NextResponse.json({ results, prompt: results[0]?.prompt ?? '' });
  } catch (error) {
    console.error('[generate-from-phrase] error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
