import { NextResponse } from 'next/server';
import { getCustomer } from '@/app/customer-auth';

export async function GET() {
  const user = await getCustomer();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { name: user.name, email: user.email } });
}
