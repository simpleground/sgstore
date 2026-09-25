import { getD1 } from '@/db';
import { SUPPORTED_COURIERS } from '@/lib/biteship';

export async function getCourierSettings(storeId: string) {
  const rows = await getD1()
    .prepare(
      'SELECT courier_code,active FROM shipping_settings WHERE store_id=?',
    )
    .bind(storeId)
    .all<{ courier_code: string; active: number }>();
  const saved = new Map(
    rows.results.map((row) => [row.courier_code, Boolean(row.active)]),
  );
  return SUPPORTED_COURIERS.map((courier) => ({
    ...courier,
    active: saved.get(courier.code) ?? true,
  }));
}

export async function getEnabledCourierCodes(storeId: string) {
  return (await getCourierSettings(storeId))
    .filter((courier) => courier.active)
    .map((courier) => courier.code);
}
