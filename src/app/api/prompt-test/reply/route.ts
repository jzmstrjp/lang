import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { TEXT_MODEL_RICH_SCENE } from '@/const';
import { buildEnglishReplyPrompt, translateJapanese } from '@/lib/problem-generator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type RequestBody = {
  senderName?: string;
  receiverName?: string;
  senderRole?: string;
  receiverRole?: string;
  senderVoice?: string;
  receiverVoice?: string;
  englishSentence?: string;
  place?: string;
  receiverPlace?: string;
  how?: string;
  senderWhen?: string;
  senderWhy?: string;
  senderWant?: string;
  isKids?: boolean;
  additionalInstruction?: string;
  englishReply?: string;
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
      place,
      receiverPlace,
      how,
      senderWhen,
      senderWhy,
      senderWant,
      isKids = false,
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

    const englishPrompt =
      buildEnglishReplyPrompt({
        senderName,
        receiverName,
        who: senderRole,
        whom: receiverRole,
        senderGender,
        receiverGender,
        englishSentence,
        when: senderWhen,
        where: place,
        receiverPlace,
        why: senderWhy,
        how,
        want: senderWant,
        isKids,
        additionalInstruction: additionalInstruction?.trim() || undefined,
      }) +
      `\n【重要】以下のJSON形式で必ず回答してください:
\`\`\`json
{
  "englishReply": "ここに返答の英文が入る。"
}
\`\`\``;

    const englishResponse = await openai.responses.create({
      model: TEXT_MODEL_RICH_SCENE,
      input: [{ role: 'user', content: englishPrompt }],
      temperature: 0.9,
    });

    if (englishResponse.status === 'incomplete') {
      return NextResponse.json({ error: 'AI応答が不完全でした。' }, { status: 500 });
    }

    const englishContent = englishResponse.output_text;
    if (!englishContent) {
      return NextResponse.json({ error: 'AI応答が空でした。' }, { status: 500 });
    }

    const englishJsonMatch = englishContent.match(/```json\n([\s\S]*?)```/);
    if (!englishJsonMatch?.[1]) {
      return NextResponse.json({ error: 'AI応答のパースに失敗しました。' }, { status: 500 });
    }

    const englishResult = JSON.parse(englishJsonMatch[1]) as { englishReply: string };
    if (!englishResult.englishReply) {
      return NextResponse.json({ error: 'englishReply が取得できませんでした。' }, { status: 500 });
    }

    const englishReply = englishResult.englishReply.trim();

    const japaneseReply = await translateJapanese(openai, {
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
      translate: 'receiver',
    });

    return NextResponse.json({ englishReply, japaneseReply });
  } catch (error) {
    console.error('[prompt-test/reply] エラーが発生しました', error);
    return NextResponse.json({ error: '返答の生成に失敗しました。' }, { status: 500 });
  }
}
