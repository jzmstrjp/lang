import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { TEXT_MODEL } from '@/const';
import { buildEnglishReplyPrompt, translateJapanese } from '@/lib/problem-generator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  problemId?: string;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const { problemId } = body;

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json({ error: 'problemId が不正です。' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
    }

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    // englishReply を再生成
    const englishPrompt =
      `「${problem.englishReply}」とは異なる返答を1つ作成してください。` +
      buildEnglishReplyPrompt({
        senderName: problem.senderName,
        receiverName: problem.receiverName,
        who: problem.senderRole,
        whom: problem.receiverRole,
        senderGender: problem.senderVoice === 'male' ? '男性' : '女性',
        receiverGender: problem.receiverVoice === 'male' ? '男性' : '女性',
        englishSentence: problem.englishSentence,
        where: problem.place,
        receiverPlace: problem.receiverPlace,
        why: problem.senderWhy,
        how: problem.how,
        when: problem.senderWhen,
      }) +
      `【重要】以下のJSON形式で必ず回答してください:
\`\`\`json
{
  "englishReply": "ここに返答の英文が入る。"
}
\`\`\``;

    const englishResponse = await openai.responses.create({
      model: TEXT_MODEL,
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

    const newEnglishReply = englishResult.englishReply.trim();

    // japaneseReply を翻訳生成
    const newJapaneseReply = await translateJapanese(openai, {
      senderName: problem.senderName,
      receiverName: problem.receiverName,
      place: problem.place,
      how: problem.how,
      senderWhen: problem.senderWhen,
      receiverPlace: problem.receiverPlace,
      senderWhy: problem.senderWhy,
      senderWant: problem.senderWant,
      senderRole: problem.senderRole,
      senderGender: problem.senderVoice === 'male' ? '男性' : '女性',
      englishSentence: problem.englishSentence,
      receiverRole: problem.receiverRole,
      receiverGender: problem.receiverVoice === 'male' ? '男性' : '女性',
      englishReply: newEnglishReply,
      translate: 'receiver',
    });

    return NextResponse.json({
      success: true,
      englishReply: newEnglishReply,
      japaneseReply: newJapaneseReply,
    });
  } catch (error) {
    console.error('[regenerate-reply] エラーが発生しました', error);
    return NextResponse.json({ error: '返答の再生成に失敗しました。' }, { status: 500 });
  }
}
