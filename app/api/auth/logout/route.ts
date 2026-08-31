import { NextResponse } from 'next/server';
import { clearCustomerSession } from '@/app/customer-auth';
export async function POST() {
  await clearCustomerSession();
  return NextResponse.json({ ok: true });
}
