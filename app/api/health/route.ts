import { NextResponse } from 'next/server';
import { getD1 } from '@/db';

export const dynamic = 'force-dynamic';

/** Health check for PM2 / Nginx / uptime monitors. */
export async function GET() {
  try {
    await getD1().prepare('SELECT 1 AS ok').first();
    return NextResponse.json({ ok: true, database: 'up' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, database: 'down', error: error instanceof Error ? error.message : 'unknown' },
      { status: 503 },
    );
  }
}
