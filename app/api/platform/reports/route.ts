import { requireSuperAdmin } from '@/lib/admin-auth';
import {
  assertStoreExists,
  reportErrorResponse,
  reportResponse,
} from '@/lib/reports';

/**
 * Reports of every store, or one store with ?store=<id> (platform super_admin).
 * ?report=finance|products|inventory, &format=csv downloads it.
 */
export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const storeId = params.get('store')?.trim() || null;
    if (storeId) await assertStoreExists(storeId);
    return await reportResponse(
      storeId,
      params,
      storeId ? 'toko' : 'semua-website',
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}
