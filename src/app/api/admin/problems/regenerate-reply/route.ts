import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import {
  TEXT_MODEL,
  JAPANESE_TRANSLATION_RULES,
  TRANSLATION_FORMAT_RULES,
  TTS_READING_RULES,
} from '@/const';
import { buildEnglishReplyPrompt } from '@/lib/problem-generator';

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
        who: problem.senderRole,
        whom: problem.receiverRole,
        senderGender: problem.senderVoice === 'male' ? '男性' : '女性',
        receiverGender: problem.receiverVoice === 'male' ? '男性' : '女性',
        englishSentence: problem.englishSentence,
        where: problem.place,
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
    const japanesePrompt = `以下の英会話を自然な日本語に翻訳してください。

【シーン情報】
- 場所: ${problem.place}
${problem.scenePrompt ? `- 文脈: ${problem.scenePrompt}` : ''}

【送信者】
- 役割: ${problem.senderRole}
- 英文: "${problem.englishSentence}"
- 性別: ${problem.senderVoice === 'male' ? '男性' : '女性'}

【受信者】
- 役割: ${problem.receiverRole}
- 英文: "${newEnglishReply}"
- 性別: ${problem.receiverVoice === 'male' ? '男性' : '女性'}

【生成対象】
- japaneseReply: 受信者の英文を自然な日本語に翻訳

【翻訳ルール】
${JAPANESE_TRANSLATION_RULES}
${TRANSLATION_FORMAT_RULES}
${TTS_READING_RULES}

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "japaneseReply": "ここに返答の日本語訳が入る。"
}
\`\`\``;

    const japaneseResponse = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: japanesePrompt }],
      temperature: 0.5,
    });

    if (japaneseResponse.status === 'incomplete') {
      return NextResponse.json({ error: 'AI応答が不完全でした。' }, { status: 500 });
    }

    const japaneseContent = japaneseResponse.output_text;
    if (!japaneseContent) {
      return NextResponse.json({ error: 'AI応答が空でした。' }, { status: 500 });
    }

    const japaneseJsonMatch = japaneseContent.match(/```json\n([\s\S]*?)```/);
    if (!japaneseJsonMatch?.[1]) {
      return NextResponse.json({ error: 'AI応答のパースに失敗しました。' }, { status: 500 });
    }

    const japaneseResult = JSON.parse(japaneseJsonMatch[1]) as { japaneseReply: string };
    if (!japaneseResult.japaneseReply) {
      return NextResponse.json(
        { error: 'japaneseReply が取得できませんでした。' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      englishReply: newEnglishReply,
      japaneseReply: japaneseResult.japaneseReply.trim(),
    });
  } catch (error) {
    console.error('[regenerate-reply] エラーが発生しました', error);
    return NextResponse.json({ error: '返答の再生成に失敗しました。' }, { status: 500 });
  }
}
