import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { TEXT_MODEL } from '@/const';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  englishSentence?: string;
  japaneseSentence?: string;
  scenePrompt?: string | null;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const { englishSentence, japaneseSentence, scenePrompt } = body;

    if (!englishSentence || typeof englishSentence !== 'string') {
      return NextResponse.json({ error: 'englishSentence が不正です。' }, { status: 400 });
    }

    if (!japaneseSentence || typeof japaneseSentence !== 'string') {
      return NextResponse.json({ error: 'japaneseSentence が不正です。' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
    }

    const prompt = `${scenePrompt ? `【文脈】${scenePrompt}` : ''}

${scenePrompt ? '上記の文脈で' : ''}「${englishSentence}」という英文を、自然で質の高い日本語訳にしたいです。

日本語訳を生成してください。
文脈に沿った翻訳をしてください。ただし、文脈に引っ張られ過ぎないでください。英文中にない意味を勝手に足さないでください。
できるだけカタカナ英語は避けて、ちゃんと日本語に翻訳してください。
日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。
正しさと自然さを兼ね備えた翻訳をすること。

重要: 日本語訳のテキストのみを出力してください。説明や解説は不要です。`;

    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    if (response.status === 'incomplete') {
      const detail = response.incomplete_details?.reason ?? 'unknown';
      console.error('[improve-translation] GPTレスポンスが不完全です', {
        status: response.status,
        detail,
      });
      return NextResponse.json({ error: `AI応答が不完全でした: ${detail}` }, { status: 500 });
    }

    const improvedTranslation = response.output_text?.trim();

    if (!improvedTranslation) {
      console.error('[improve-translation] GPTレスポンスが空です', {
        status: response.status,
        hasOutput: !!response.output_text,
      });
      return NextResponse.json({ error: 'AI応答が空でした。' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      improvedTranslation,
    });
  } catch (error) {
    console.error('[improve-translation] エラーが発生しました', error);
    return NextResponse.json({ error: '日本語訳の改善に失敗しました。' }, { status: 500 });
  }
}
