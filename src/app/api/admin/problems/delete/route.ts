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
