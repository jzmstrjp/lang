import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

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

${scenePrompt ? '上記の文脈で' : ''}「${englishSentence}」という英文を「${japaneseSentence}」と日本語訳してみましたが、さらに自然で質の高い日本語訳にしたいです。

新しい日本語訳を生成してください。
文脈に合った翻訳をお願いします。ただし、英文の中にない内容を文脈から過剰に推測して補うような翻訳は禁止します。
できるだけカタカナ英語は避けて、ちゃんと日本語に翻訳してください。
日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。
正しさと自然さを兼ね備えた翻訳をすること。

重要: 日本語訳のテキストのみを出力してください。説明や解説は不要です。`;

    const response = await openai.responses.create({
      model: 'gpt-4.1',
      input: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 1,
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
