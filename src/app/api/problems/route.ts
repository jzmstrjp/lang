import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Problem } from '@prisma/client';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { replaceUrlHost } from '@/lib/cdn-utils';

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
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 200) : 200;

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

    // WHERE条件を構築
    const conditions: string[] = [
      '"audioReady" = true',
      `"wordCount" >= ${rules.min}`,
      `"wordCount" <= ${rules.max}`,
    ];

    if (search) {
      const escapedSearch = search.replace(/'/g, "''");
      conditions.push(
        `("englishSentence" ILIKE '%${escapedSearch}%' OR "japaneseSentence" ILIKE '%${escapedSearch}%')`,
      );
    }

    const whereClause = conditions.join(' AND ');

    // PostgreSQLのRANDOM()を使って複数件をランダムに取得
    const problems = await prisma.$queryRawUnsafe<Problem[]>(
      `SELECT * FROM "problems" WHERE ${whereClause} ORDER BY RANDOM() LIMIT ${limit}`,
    );

    if (!problems || problems.length === 0) {
      return NextResponse.json({ problems: [] });
    }

    // データを整形
    const formattedProblems: ProblemWithAudio[] = problems.map((problem) => {
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

      return {
        ...problem,
        incorrectOptions,
        audioEnUrl: replaceUrlHost(problem.audioEnUrl),
        audioJaUrl: replaceUrlHost(problem.audioJaUrl),
        audioEnReplyUrl: replaceUrlHost(problem.audioEnReplyUrl),
        imageUrl: problem.imageUrl ? replaceUrlHost(problem.imageUrl) : problem.imageUrl,
      };
    });

    return NextResponse.json({ problems: formattedProblems, count: formattedProblems.length });
  } catch (error) {
    console.error('[problems] fetch error:', error);
    console.error('[problems] error details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        error: 'Failed to fetch problems',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
