import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAdminSetupCode, getD1 } from '@/db';

const adminSql = `CREATE TABLE IF NOT EXISTS admin_users (user_id TEXT PRIMARY KEY, email TEXT NOT NULL, created_at TEXT NOT NULL)`;
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return NextResponse.json({ error: 'Masuk dengan ChatGPT dahulu.' }, { status: 401 });
  const d1 = getD1(); await d1.prepare(adminSql).run();
  const existing = await d1.prepare('SELECT user_id FROM admin_users LIMIT 1').first<{ user_id: string }>();
  if (existing) return NextResponse.json({ ok: existing.user_id === user.userId }, { status: existing.user_id === user.userId ? 200 : 403 });
  const { code } = await request.json() as { code?: string }; const expected = getAdminSetupCode();
  if (!expected || code !== expected) return NextResponse.json({ error: 'Kode aktivasi tidak benar.' }, { status: 403 });
  await d1.prepare('INSERT INTO admin_users (user_id, email, created_at) VALUES (?, ?, ?)').bind(user.userId, user.email, new Date().toISOString()).run();
  return NextResponse.json({ ok: true });
}
