import { NextResponse } from 'next/server';
import { type ProblemLength } from '@/config/problem';
import { fetchProblems } from '@/lib/problem-service';

// 型を再エクスポート（既存のインポートを壊さないため）
export type { ProblemWithAudio } from '@/lib/problem-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'short') as ProblemLength;
    const rawSearch = searchParams.get('search');
    const search = rawSearch?.trim();
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // 共通のサービス関数を使用
    const result = await fetchProblems({ type, search, limit });

    return NextResponse.json(result);
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
