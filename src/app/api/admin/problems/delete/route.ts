import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { deleteMultipleFromR2 } from '@/lib/r2-client';

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
    const problemId = body.problemId;

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json({ error: 'problemId が不正です。' }, { status: 400 });
    }

    const record = await prisma.problem.findUnique({
      where: { id: problemId },
      select: {
        id: true,
        expression: true,
        difficultyLevel: true,
        imageUrl: true,
        audioEnUrl: true,
        audioEnReplyUrl: true,
        audioJaUrl: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    await prisma.problem.delete({ where: { id: problemId } });

    // 削除後に同じ expression の残り件数が 1 件になったら Word テーブルに戻す
    // （groupByExpression の HAVING COUNT(*) >= 2 で出題対象外になるため）
    if (record.expression) {
      const remaining = await prisma.problem.count({
        where: { expression: record.expression },
      });
      if (remaining === 1) {
        const isKids = record.difficultyLevel === 1;
        await prisma.word.upsert({
          where: { expression: record.expression },
          update: {},
          create: { expression: record.expression, isKids },
        });
      }
    }

    const assetUrls = [
      record.imageUrl,
      record.audioEnUrl,
      record.audioEnReplyUrl,
      record.audioJaUrl,
    ].filter((url): url is string => typeof url === 'string' && url.length > 0);

    if (assetUrls.length > 0) {
      await deleteMultipleFromR2(assetUrls);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    console.error('[admin-delete-problem] エラーが発生しました', error);
    return NextResponse.json({ error: '問題の削除に失敗しました。' }, { status: 500 });
  }
}
