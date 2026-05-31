import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { prisma } from '@/lib/prisma';
import { wordWhereForProblemLength } from '@/lib/word-query';

const VALID_TYPES = Object.keys(WORD_COUNT_RULES) as ProblemLength[];

function parseType(searchParams: URLSearchParams): ProblemLength | null {
  const type = searchParams.get('type');
  if (!type || !VALID_TYPES.includes(type as ProblemLength)) return null;
  return type as ProblemLength;
}

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email || !(await isAdminEmail(email))) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const type = parseType(new URL(request.url).searchParams);
    if (!type) {
      return NextResponse.json(
        { error: `type は ${VALID_TYPES.join(' | ')} のいずれかを指定してください。` },
        { status: 400 },
      );
    }

    const where = wordWhereForProblemLength(type);
    const count = await prisma.word.count({ where });
    if (count === 0) {
      return NextResponse.json(
        { error: `${type} 用のフレーズが words テーブルにありません。` },
        { status: 404 },
      );
    }

    const word = await prisma.word.findFirst({
      where,
      skip: Math.floor(Math.random() * count),
      select: { expression: true, expressionJa: true },
    });

    if (!word) {
      return NextResponse.json({ error: 'フレーズの取得に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json(word);
  } catch (e) {
    console.error('random-phrase error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
