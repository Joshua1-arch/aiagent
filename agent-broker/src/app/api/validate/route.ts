import { NextResponse } from 'next/server';
import { validateASP } from '@/lib/validator';
import type { ValidateRequest } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = await req.json() as ValidateRequest;

    if (!body.aspName || !body.serviceName || !body.serviceDescription) {
      return NextResponse.json(
        { ok: false, error: 'aspName, serviceName, and serviceDescription are required' },
        { status: 400 }
      );
    }

    const result = await validateASP(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}