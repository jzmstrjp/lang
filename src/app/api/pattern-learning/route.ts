import { NextResponse } from 'next/server';
import { fetchRandomPatternSet } from '@/lib/pattern-service';

/**
 * GET /api/pattern-learning
 * ランダムなパターンセット1つを取得
 */
export async function GET() {
  try {
    const patternSet = await fetchRandomPatternSet();

    if (!patternSet) {
      return NextResponse.json({ error: 'No pattern set found' }, { status: 404 });
    }

    return NextResponse.json(patternSet);
  } catch (error) {
    console.error('[API] Pattern learning error:', error);
    return NextResponse.json({ error: 'Failed to fetch pattern set' }, { status: 500 });
  }
}
