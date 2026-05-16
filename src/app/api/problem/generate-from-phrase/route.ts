import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { type Voice, type How, generateForPhrase, HOWS } from '@/lib/phrase-generator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GENERATE_COUNT = 3;

export async function POST(req: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      phrase?: string;
      phraseJa?: string;
      additionalInstruction?: string;
      type?: ProblemLength;
      voice?: Voice;
      how?: How;
    };

    const phrase = body.phrase?.trim();
    if (!phrase) {
      return NextResponse.json({ error: 'phrase は必須です。' }, { status: 400 });
    }
    const phraseJa = body.phraseJa?.trim() ?? '';

    const type = body.type ?? 'short';
    const rule = WORD_COUNT_RULES[type];
    if (!rule) {
      return NextResponse.json({ error: `無効な type: ${type}` }, { status: 400 });
    }

    const additionalInstruction = body.additionalInstruction?.trim() ?? '';

    const usedSentences: string[] = [];
    const results = [];

    for (let i = 0; i < GENERATE_COUNT; i++) {
      const voice: Voice =
        body.voice ?? (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
      const how: How = body.how ?? HOWS[Math.floor(Math.random() * HOWS.length)]!;
      const result = await generateForPhrase(openai, {
        phrase,
        phraseJa,
        wordCountLength: type,
        voice,
        how,
        additionalInstruction,
        usedSentences,
      });
      if (result) {
        usedSentences.push(result.englishSentence);
        results.push(result);
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[generate-from-phrase] error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
