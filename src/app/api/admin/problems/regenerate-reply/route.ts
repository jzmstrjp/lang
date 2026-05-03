import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { TEXT_MODEL } from '@/const';

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
    const englishPrompt = `以下のシーン設定に基づいて、以下の英文に対する自然な英語の返答を作成してください。

【シーン情報】
- 場所: ${problem.place}
${problem.scenePrompt ? `- 文脈: ${problem.scenePrompt}` : ''}

【送信者】
- 役割: ${problem.senderRole}
- 性別: ${problem.senderVoice === 'male' ? '男性' : '女性'}
- 英文: "${problem.englishSentence}"

【受信者（返答する人）】
- 役割: ${problem.receiverRole}
- 性別: ${problem.receiverVoice === 'male' ? '男性' : '女性'}

【重要な要件】
1. englishReply: 受信者の返答。englishSentenceに対する、要点を押さえつつできるだけ短い回答であること。目安は8単語以内。englishReplyを読めばenglishSentenceの内容が想像できるような、具体的な言及を含む文がいい。
   - 例: "Can you play the guitar?" に対して "Yeah, but I can only play a few songs."
   - 例: "Are you hungry?" に対して "Yes, I want some pizza."
   - 「こう返答したってことは、きっとこう話しかけられたんだろうな」と推測できるような内容にすること。
2. 自然な口語表現で、実際の会話らしくすること。
3. 文脈に合った適切な内容にすること。

【重要】以下のJSON形式で必ず回答してください:

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
機械音声で読み上げるための日本語文なので、括弧書きは含めないでください。
最後は「。」または「？」で終わること。

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

【重要な要件】
1. japaneseReply: 受信者の英文を自然な日本語に翻訳
2. シーンや役割に合った適切な日本語表現にすること
3. 口語的で自然な会話になるようにすること
4. 英文に含まれていない情報は日本語訳に含めないこと。
5. カタカナ英語は避け、ちゃんと日本語に翻訳すること。ただし、日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。
6. TTSに読み上げさせるため、読み方が曖昧な漢字（例: 「辛く」は「からく」とも「つらく」とも読める）だけは、半角スペースで挟んだ" からく "の形式で書くこと。TTSにとってかなり読みにくい漢字（例: 「今朝」→「けさ」、「絆創膏」→「ばんそうこう」）も半角スペースで挟んだ" ひらがな "の形式で書くこと。そのまま読めそうな漢字は漢字のままでいい。

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
