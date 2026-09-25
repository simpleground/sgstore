import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import {
  assertStoreExists,
  buildReport,
  csvResponse,
  exportOrdersCsv,
  readPeriod,
  reportErrorResponse,
} from '@/lib/reports';

/**
 * Sales report of every store, or one store with ?store=<id>.
 * ?format=csv downloads the orders of the period.
 */
export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const period = readPeriod(params);
    const storeId = params.get('store')?.trim() || null;
    if (storeId) await assertStoreExists(storeId);
    if (params.get('format') === 'csv')
      return csvResponse(
        await exportOrdersCsv(storeId, period),
        storeId ? 'toko' : 'semua-website',
        period,
      );
    return NextResponse.json(await buildReport(storeId, period), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return reportErrorResponse(error);
  }
}
