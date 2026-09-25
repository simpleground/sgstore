/**
 * Catatan aktivitas admin (tabel audit_logs).
 *
 * Mencatat tidak boleh menggagalkan aksi yang sudah berhasil: bila penyimpanan
 * catatan gagal, galat hanya ditulis ke log server.
 */
import { headers } from 'next/headers';
import { getD1 } from '@/db';

export type AuditActor = { userId: string; email: string };

export type AuditEntry = {
  storeId: string | null;
  action: string;
  target?: { type: string; id: string };
  meta?: Record<string, unknown>;
};

async function clientIp() {
  try {
    const list = await headers();
    return (
      list.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      list.get('x-real-ip') ||
      ''
    ).slice(0, 64);
  } catch {
    return '';
  }
}

export async function audit(actor: AuditActor | null, entry: AuditEntry) {
  try {
    await getD1()
      .prepare(
        'INSERT INTO audit_logs (store_id,user_id,user_email,action,target_type,target_id,meta_json,ip,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        entry.storeId,
        actor?.userId ?? null,
        actor?.email ?? '',
        entry.action,
        entry.target?.type ?? '',
        entry.target?.id ?? '',
        JSON.stringify(entry.meta ?? {}),
        await clientIp(),
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    console.error('audit log gagal disimpan:', entry.action, error);
  }
}
