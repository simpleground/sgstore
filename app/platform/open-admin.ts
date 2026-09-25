/**
 * Opens a store's admin panel in a new tab, signed in through a one-time link
 * (POST /api/platform/stores/<id>/handoff). Returns an error message or null.
 */
export async function openStoreAdmin(storeId: string) {
  // Open the tab right away (inside the click) so pop-up blockers allow it.
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const response = await fetch(`/api/platform/stores/${storeId}/handoff`, {
      method: 'POST',
    });
    const data = (await response.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!response.ok || !data.url)
      throw new Error(data.error || 'Tautan admin gagal dibuat.');
    if (tab) tab.location.href = data.url;
    else window.location.assign(data.url);
    return null;
  } catch (error) {
    tab?.close();
    return error instanceof Error ? error.message : 'Koneksi terputus.';
  }
}
