import { NextResponse } from 'next/server';
import { authorizeStore } from '@/lib/admin-auth';
import {
  buildReport,
  csvResponse,
  exportOrdersCsv,
  readPeriod,
  reportErrorResponse,
} from '@/lib/reports';

/** Sales report of the current store. ?format=csv downloads the orders of the period. */
export async function GET(request: Request) {
  const auth = await authorizeStore('reports.view');
  if (!auth.ok) return auth.response;
  const { store } = auth.admin;
  try {
    const params = new URL(request.url).searchParams;
    const period = readPeriod(params);
    if (params.get('format') === 'csv')
      return csvResponse(
        await exportOrdersCsv(store.id, period),
        store.slug,
        period,
      );
    return NextResponse.json(await buildReport(store.id, period), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return reportErrorResponse(error);
  }
}
