import { NextRequest, NextResponse } from 'next/server';
import { ProblemType } from '@prisma/client';

import { fetchCachedProblem } from '@/lib/problem-storage';

function resolveProblemType(value: string | null): ProblemType {
  if (value === 'medium' || value === 'long') {
    return value;
  }
  return 'short';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = resolveProblemType(searchParams.get('type'));
  const includeUnreviewed = searchParams.get('includeUnreviewed') === 'true';

  try {
    const cached = await fetchCachedProblem(type, {
      requireQualityCheck: !includeUnreviewed,
    });

    if (!cached) {
      return NextResponse.json(
        { error: 'Cached problem not found for requested type' },
        { status: 404 },
      );
    }

    return NextResponse.json(cached);
  } catch (error) {
    console.error('[problem] fetch cached error', error);
    return NextResponse.json({ error: 'Failed to fetch cached problem' }, { status: 500 });
  }
}
