import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

type RequestBody = {
  problemId?: string;
  optionIndex?: number;
  text?: string;
};

function normalizeIncorrectOptions(value: Prisma.JsonValue | null): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? ''));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item ?? '')) : [];
    } catch {
      return [];
    }
  }

  return [];
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const problemId = body.problemId;
    const optionIndex = body.optionIndex;
    const text = body.text;

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json({ error: 'problemId が不正です。' }, { status: 400 });
    }

    if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex) || optionIndex < 0) {
      return NextResponse.json({ error: 'optionIndex が不正です。' }, { status: 400 });
    }

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text が不正です。' }, { status: 400 });
    }

    const record = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { incorrectOptions: true },
    });

    if (!record) {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    const incorrectOptions = normalizeIncorrectOptions(record.incorrectOptions);

    if (optionIndex >= incorrectOptions.length) {
      return NextResponse.json({ error: 'optionIndex が範囲外です。' }, { status: 400 });
    }

    const trimmedText = text.trim();
    incorrectOptions[optionIndex] = trimmedText;

    const updated = await prisma.problem.update({
      where: { id: problemId },
      data: { incorrectOptions },
      select: { incorrectOptions: true },
    });

    return NextResponse.json({
      success: true,
      incorrectOptions: normalizeIncorrectOptions(updated.incorrectOptions),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された問題が見つかりません。' }, { status: 404 });
    }

    console.error('[admin-update-incorrect-option] エラーが発生しました', error);
    return NextResponse.json({ error: '選択肢の更新に失敗しました。' }, { status: 500 });
  }
}
