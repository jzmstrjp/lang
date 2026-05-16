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
  how?: string;
  senderWhen?: string;
  place?: string;
  receiverPlace?: string;
  senderWhy?: string;
  senderWant?: string;
  senderRole?: string;
  senderName?: string;
  senderVoice?: string;
  englishReply?: string;
  receiverRole?: string;
  receiverName?: string;
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
      how,
      senderWhen,
      senderName,
      receiverName,
      place,
      receiverPlace,
      senderWhy,
      senderWant,
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

    if (
      !place ||
      !how ||
      !senderWhen ||
      !receiverPlace ||
      !senderWhy ||
      !senderWant ||
      !senderRole ||
      !senderVoice ||
      !senderName ||
      !receiverName ||
      !englishReply ||
      !receiverRole ||
      !receiverVoice
    ) {
      return NextResponse.json({ error: '文脈情報が不足しています。' }, { status: 400 });
    }

    const improvedTranslation = await translateJapanese(openai, {
      senderName,
      receiverName,
      place,
      how,
      senderWhen,
      receiverPlace,
      senderWhy,
      senderWant,
      senderRole,
      senderGender: senderVoice === 'male' ? '男性' : '女性',
      englishSentence,
      receiverRole,
      receiverGender: receiverVoice === 'male' ? '男性' : '女性',
      englishReply,
      translate: 'sender',
      japanese: japaneseSentence,
    });

    return NextResponse.json({ success: true, improvedTranslation });
  } catch (error) {
    console.error('[improve-translation] エラーが発生しました', error);
    return NextResponse.json({ error: '日本語訳の改善に失敗しました。' }, { status: 500 });
  }
}
