import { authorizeStore } from '@/lib/admin-auth';
import { reportErrorResponse, reportResponse } from '@/lib/reports';

/**
 * Reports of the current store only (?store= from the browser is ignored).
 * ?report=finance|products|inventory, &format=csv downloads it.
 */
export async function GET(request: Request) {
  const auth = await authorizeStore('reports.view');
  if (!auth.ok) return auth.response;
  const { store } = auth.admin;
  try {
    return await reportResponse(
      store.id,
      new URL(request.url).searchParams,
      store.slug,
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}
