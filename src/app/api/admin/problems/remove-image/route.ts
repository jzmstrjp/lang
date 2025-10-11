import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

type RequestBody = {
  problemId?: string;
  removeImage?: boolean;
  removeEnglishAudio?: boolean;
  removeEnglishReplyAudio?: boolean;
  removeJapaneseReplyAudio?: boolean;
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

    // どのフィールドをnullにするか
    const updateData: Record<string, any> = {};

    if (body.removeImage) updateData.imageUrl = null;
    if (body.removeEnglishAudio) updateData.englishAudioUrl = null;
    if (body.removeEnglishReplyAudio) updateData.englishReplyAudioUrl = null;
    if (body.removeJapaneseReplyAudio) updateData.japaneseReplyAudioUrl = null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '削除対象が指定されていません。' }, { status: 400 });
    }

    await prisma.problem.update({
      where: { id: problemId },
      data: updateData,
      select: { id: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    console.error('[admin-remove-problem-asset] エラーが発生しました', error);
    return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
  }
}