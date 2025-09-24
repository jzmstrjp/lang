import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'short') as ProblemLength;

    // WORD_COUNT_RULESに基づいて単語数の範囲を決定
    const rules = WORD_COUNT_RULES[type];
    if (!rules) {
      return NextResponse.json(
        {
          error: `Invalid type: ${type}. Valid types are: ${Object.keys(WORD_COUNT_RULES).join(', ')}`,
        },
        { status: 400 },
      );
    }

    const wordCountFilter: Prisma.ProblemWhereInput = {
      wordCount: { gte: rules.min, lte: rules.max },
      // 音声URLが両方とも存在するレコードのみを対象にする
      audioEnUrl: { not: null },
      audioJaUrl: { not: null },
      audioEnReplyUrl: { not: null },
    } as Prisma.ProblemWhereInput;

    const totalCount = await prisma.problem.count({
      where: wordCountFilter,
    });

    if (totalCount === 0) {
      return NextResponse.json(
        { error: `No ${type} problems with audio found in database` },
        { status: 404 },
      );
    }

    // ランダムなskip値を計算
    const randomSkip = Math.floor(Math.random() * totalCount);

    const problem = await prisma.problem.findFirst({
      where: wordCountFilter,
      skip: randomSkip,
    });

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    // incorrectOptionsをJSON文字列から配列に変換
    let incorrectOptions: string[] = [];
    try {
      if (typeof problem.incorrectOptions === 'string') {
        incorrectOptions = JSON.parse(problem.incorrectOptions);
      } else if (Array.isArray(problem.incorrectOptions)) {
        incorrectOptions = problem.incorrectOptions.map(String);
      }
    } catch {
      console.warn('Failed to parse incorrectOptions:', problem.incorrectOptions);
      incorrectOptions = [];
    }

    const response = {
      problem: {
        ...problem,
        incorrectOptions,
      },
      assets: {
        imageUrl: problem.imageUrl || null,
        audio: {
          english: problem.audioEnUrl || '',
          japanese: problem.audioJaUrl || '',
          englishReply: problem.audioEnReplyUrl || '',
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[problem] fetch error:', error);
    console.error('[problem] error details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        error: 'Failed to fetch problem',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
