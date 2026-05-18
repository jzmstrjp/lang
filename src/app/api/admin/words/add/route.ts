import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

type RequestBody = {
  expression?: string;
  expressionJa?: string;
  isKids?: boolean;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const { expression, expressionJa, isKids = false } = body;

    if (!expression || typeof expression !== 'string') {
      return NextResponse.json({ error: 'expression が不正です。' }, { status: 400 });
    }
    if (!expressionJa || typeof expressionJa !== 'string') {
      return NextResponse.json({ error: 'expressionJa が不正です。' }, { status: 400 });
    }

    await prisma.word.upsert({
      where: {
        expression_expressionJa_isKids: { expression, expressionJa, isKids },
      },
      update: {},
      create: { expression, expressionJa, isKids },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin-words-add] エラーが発生しました', error);
    return NextResponse.json({ error: 'words への追加に失敗しました。' }, { status: 500 });
  }
}
