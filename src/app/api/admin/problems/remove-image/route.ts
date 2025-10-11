import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

type RequestBody = {
  problemId?: string;
  field?: RemovableField;
};

const removableFields = ['imageUrl', 'audioEnUrl', 'audioEnReplyUrl', 'audioJaUrl'] as const;
type RemovableField = (typeof removableFields)[number];

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const problemId = body.problemId;
    const field = body.field ?? 'imageUrl';

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json({ error: 'problemId が不正です。' }, { status: 400 });
    }

    if (!removableFields.includes(field)) {
      return NextResponse.json({ error: '削除対象フィールドが不正です。' }, { status: 400 });
    }

    const data: Prisma.ProblemUpdateInput = {};

    switch (field) {
      case 'imageUrl':
        data.imageUrl = null;
        break;
      case 'audioEnUrl':
        data.audioEnUrl = null;
        data.audioReady = false;
        break;
      case 'audioEnReplyUrl':
        data.audioEnReplyUrl = null;
        data.audioReady = false;
        break;
      case 'audioJaUrl':
        data.audioJaUrl = null;
        data.audioReady = false;
        break;
      default:
        return NextResponse.json({ error: '削除対象フィールドが不正です。' }, { status: 400 });
    }

    await prisma.problem.update({
      where: { id: problemId },
      data,
      select: { id: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    console.error('[admin-remove-problem-image] エラーが発生しました', error);
    return NextResponse.json({ error: 'リソースの削除に失敗しました。' }, { status: 500 });
  }
}
