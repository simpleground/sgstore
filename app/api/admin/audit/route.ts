import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { authorizeStore } from '@/lib/admin-auth';

/** Latest activity of the current store. `?before=<id>` loads older entries. */
export async function GET(request: Request) {
  const auth = await authorizeStore('audit.view');
  if (!auth.ok) return auth.response;
  const before = Number(new URL(request.url).searchParams.get('before'));
  const { results } = await getD1()
    .prepare(
      `SELECT id, user_email AS "userEmail", action, target_type AS "targetType",
              target_id AS "targetId", meta_json AS "metaJson", ip, created_at AS "createdAt"
       FROM audit_logs WHERE store_id=? AND (?::bigint IS NULL OR id < ?::bigint)
       ORDER BY id DESC LIMIT 100`,
    )
    .bind(
      auth.admin.store.id,
      Number.isSafeInteger(before) && before > 0 ? before : null,
      Number.isSafeInteger(before) && before > 0 ? before : null,
    )
    .all();
  return NextResponse.json(
    { entries: results },
    { headers: { 'cache-control': 'no-store' } },
  );
}
