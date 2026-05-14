import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

type RequestBody = {
  problemId?: string;
  senderWhen?: string;
  place?: string;
  receiverPlace?: string;
  senderRole?: string;
  receiverRole?: string;
  senderWhy?: string;
  senderWant?: string;
};

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const {
      problemId,
      senderWhen,
      place,
      receiverPlace,
      senderRole,
      receiverRole,
      senderWhy,
      senderWant,
    } = body;

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json({ error: 'problemId が不正です。' }, { status: 400 });
    }

    const data: Prisma.ProblemUpdateInput = {};
    if (senderWhen !== undefined) data.senderWhen = senderWhen.trim();
    if (place !== undefined) data.place = place.trim();
    if (receiverPlace !== undefined) data.receiverPlace = receiverPlace.trim();
    if (senderRole !== undefined) data.senderRole = senderRole.trim();
    if (receiverRole !== undefined) data.receiverRole = receiverRole.trim();
    if (senderWhy !== undefined) data.senderWhy = senderWhy.trim();
    if (senderWant !== undefined) data.senderWant = senderWant.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '更新するフィールドがありません。' }, { status: 400 });
    }

    const updated = await prisma.problem.update({
      where: { id: problemId },
      data,
      select: {
        senderWhen: true,
        place: true,
        receiverPlace: true,
        senderRole: true,
        receiverRole: true,
        senderWhy: true,
        senderWant: true,
      },
    });

    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    console.error('[update-scene] エラーが発生しました', error);
    return NextResponse.json({ error: 'シーン情報の更新に失敗しました。' }, { status: 500 });
  }
}
