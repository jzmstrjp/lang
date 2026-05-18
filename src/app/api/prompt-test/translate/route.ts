import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { translateJapanese } from '@/lib/problem-generator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type RequestBody = {
  senderName?: string;
  receiverName?: string;
  senderRole?: string;
  receiverRole?: string;
  senderVoice?: string;
  receiverVoice?: string;
  englishSentence?: string;
  englishReply?: string;
  place?: string;
  receiverPlace?: string;
  how?: string;
  senderWhen?: string;
  senderWhy?: string;
  senderWant?: string;
  translate?: 'sender' | 'receiver';
  additionalInstruction?: string;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
    }

    const body = (await request.json()) as RequestBody;
    const {
      senderName,
      receiverName,
      senderRole,
      receiverRole,
      senderVoice,
      receiverVoice,
      englishSentence,
      englishReply,
      place,
      receiverPlace,
      how,
      senderWhen,
      senderWhy,
      senderWant,
      translate = 'sender',
      additionalInstruction,
    } = body;

    if (
      !senderName ||
      !receiverName ||
      !senderRole ||
      !receiverRole ||
      !senderVoice ||
      !receiverVoice ||
      !englishSentence ||
      !englishReply ||
      !place ||
      !receiverPlace ||
      !how ||
      !senderWhen ||
      !senderWhy ||
      !senderWant
    ) {
      return NextResponse.json({ error: '必須フィールドが不足しています。' }, { status: 400 });
    }

    const senderGender: '男性' | '女性' = senderVoice === 'male' ? '男性' : '女性';
    const receiverGender: '男性' | '女性' = receiverVoice === 'male' ? '男性' : '女性';

    const japanese = await translateJapanese(openai, {
      senderName,
      receiverName,
      place,
      how,
      senderWhen,
      receiverPlace,
      senderWhy,
      senderWant,
      senderRole,
      senderGender,
      englishSentence,
      receiverRole,
      receiverGender,
      englishReply,
      translate,
      additionalInstruction: additionalInstruction?.trim() || undefined,
    });

    return NextResponse.json({
      japanese,
      additionalInstruction: additionalInstruction?.trim() ?? '',
    });
  } catch (error) {
    console.error('[prompt-test/translate] エラーが発生しました', error);
    return NextResponse.json({ error: '翻訳に失敗しました。' }, { status: 500 });
  }
}
