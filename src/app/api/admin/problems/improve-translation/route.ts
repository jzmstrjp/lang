import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { translateJapanese } from '@/lib/problem-generator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  englishSentence?: string;
  japaneseSentence?: string;
  scenePrompt?: string | null;
  place?: string;
  senderRole?: string;
  senderVoice?: string;
  englishReply?: string;
  receiverRole?: string;
  receiverVoice?: string;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const {
      englishSentence,
      japaneseSentence,
      scenePrompt,
      place,
      senderRole,
      senderVoice,
      englishReply,
      receiverRole,
      receiverVoice,
    } = body;

    if (!englishSentence || typeof englishSentence !== 'string') {
      return NextResponse.json({ error: 'englishSentence が不正です。' }, { status: 400 });
    }

    if (!japaneseSentence || typeof japaneseSentence !== 'string') {
      return NextResponse.json({ error: 'japaneseSentence が不正です。' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
    }

    if (!place || !senderRole || !senderVoice || !englishReply || !receiverRole || !receiverVoice) {
      return NextResponse.json({ error: '文脈情報が不足しています。' }, { status: 400 });
    }

    const improvedTranslation = await translateJapanese(openai, {
      place,
      scenePrompt: scenePrompt ?? null,
      senderRole,
      senderGender: senderVoice === 'male' ? '男性' : '女性',
      englishSentence,
      receiverRole,
      receiverGender: receiverVoice === 'male' ? '男性' : '女性',
      englishReply,
      translate: 'sender',
    });

    return NextResponse.json({ success: true, improvedTranslation });
  } catch (error) {
    console.error('[improve-translation] エラーが発生しました', error);
    return NextResponse.json({ error: '日本語訳の改善に失敗しました。' }, { status: 500 });
  }
}
