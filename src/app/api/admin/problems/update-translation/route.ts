import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

type RequestBody = {
  problemId?: string;
  japaneseSentence?: string;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const { problemId, japaneseSentence } = body;

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json({ error: 'problemId が不正です。' }, { status: 400 });
    }

    if (!japaneseSentence || typeof japaneseSentence !== 'string' || !japaneseSentence.trim()) {
      return NextResponse.json({ error: 'japaneseSentence が不正です。' }, { status: 400 });
    }

    const updated = await prisma.problem.update({
      where: { id: problemId },
      data: { japaneseSentence: japaneseSentence.trim() },
      select: { japaneseSentence: true },
    });

    return NextResponse.json({
      success: true,
      japaneseSentence: updated.japaneseSentence,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    console.error('[update-translation] エラーが発生しました', error);
    return NextResponse.json({ error: '日本語訳の更新に失敗しました。' }, { status: 500 });
  }
}
