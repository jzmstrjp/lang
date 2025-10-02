import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma, Problem } from '@prisma/client';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';

/**
 * URLのホスト名をNEXT_PUBLIC_R2_PUBLIC_DOMAINに置換
 */
function replaceUrlHost(url: string | null): string {
  if (!url) return '';

  const NEXT_PUBLIC_R2_PUBLIC_DOMAIN = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
  if (!NEXT_PUBLIC_R2_PUBLIC_DOMAIN) {
    console.warn('[API] NEXT_PUBLIC_R2_PUBLIC_DOMAIN not set, returning original URL');
    return url;
  }

  try {
    const urlObj = new URL(url);
    // パス部分のみを取得（先頭の "/" を削除）
    const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;

    // NEXT_PUBLIC_R2_PUBLIC_DOMAINがスラッシュで終わっていたら削除
    const domain = NEXT_PUBLIC_R2_PUBLIC_DOMAIN.endsWith('/')
      ? NEXT_PUBLIC_R2_PUBLIC_DOMAIN.slice(0, -1)
      : NEXT_PUBLIC_R2_PUBLIC_DOMAIN;

    return `${domain}/${path}`;
  } catch (error) {
    console.error('[API] Invalid URL format:', url, error);
    return url;
  }
}

export type ProblemWithAudio = Omit<
  Problem,
  'incorrectOptions' | 'audioEnUrl' | 'audioJaUrl' | 'audioEnReplyUrl'
> & {
  incorrectOptions: string[];
  audioEnUrl: string;
  audioJaUrl: string;
  audioEnReplyUrl: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'short') as ProblemLength;
    const rawSearch = searchParams.get('search');
    const search = rawSearch?.trim();

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

    const where: Prisma.ProblemWhereInput = {
      audioReady: true,
      wordCount: {
        gte: rules.min,
        lte: rules.max,
      },
    };

    if (search) {
      where.OR = [
        {
          englishSentence: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          japaneseSentence: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const totalCount = await prisma.problem.count({ where });

    if (totalCount === 0) {
      return NextResponse.json(
        { error: `No ${type} problems with audio found in database` },
        { status: 404 },
      );
    }

    const randomOffset = Math.floor(Math.random() * totalCount);

    const [problem] = await prisma.problem.findMany({
      where,
      skip: randomOffset,
      take: 1,
      orderBy: {
        id: 'asc',
      },
    });

    if (!problem) {
      return NextResponse.json(
        { error: `No ${type} problems with audio found in database` },
        { status: 404 },
      );
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

    // URLのホスト名をNEXT_PUBLIC_R2_PUBLIC_DOMAINに置換
    const response = {
      problem: {
        ...problem,
        incorrectOptions,
        audioEnUrl: replaceUrlHost(problem.audioEnUrl),
        audioJaUrl: replaceUrlHost(problem.audioJaUrl),
        audioEnReplyUrl: replaceUrlHost(problem.audioEnReplyUrl),
        imageUrl: problem.imageUrl ? replaceUrlHost(problem.imageUrl) : problem.imageUrl,
      } as ProblemWithAudio,
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
