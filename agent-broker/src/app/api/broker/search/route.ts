import { NextResponse } from 'next/server';
import { searchAgents } from '@/lib/onchainos';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, budget } = body as { query: string; budget: number };

    if (!query || typeof budget !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'query and budget are required' },
        { status: 400 }
      );
    }

    const result = await searchAgents(query, budget);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
