import { NextResponse } from 'next/server';
import type { ProblemLength } from '@/config/problem';
import { fetchFirstProblem } from '@/lib/problem-cache';

export const runtime = 'edge';

const validTypes: readonly ProblemLength[] = ['short', 'medium', 'long'];

export async function GET(_request: Request, context: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await context.params;
    const normalizedType = type as ProblemLength;

    if (!validTypes.includes(normalizedType)) {
      return NextResponse.json(
        { error: `Invalid type. Expected one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const problem = await fetchFirstProblem(normalizedType);
    if (!problem) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ problem });
  } catch (error) {
    console.error('[problem-cache] fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch problem from cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
