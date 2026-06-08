/**
 * Thin adapters consumed by BackupButton — delegates to cloud-sync.ts.
 * BackupButton UI stays unchanged; all actual sync logic lives in cloud-sync.ts.
 */
import { backupToCloud, restoreFromCloud } from './cloud-sync';

export const LAST_BACKUP_KEY = 'dtt-accounting-last-backup';

export async function backupToSupabase(): Promise<{ counts: Record<string, number> }> {
  const result = await backupToCloud();
  if (!result.success) throw new Error(result.error || 'Backup failed');
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  }
  return { counts: result.counts };
}

export async function restoreFromSupabase(): Promise<{ counts: Record<string, number> }> {
  const result = await restoreFromCloud();
  if (!result.success) throw new Error(result.error || 'Restore failed');
  return { counts: result.counts };
}

export async function getCloudRecordCounts(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch('/api/accounting/sync');
    if (!res.ok) return null;
    const data = await res.json();
    return {
      sales:         data.sales?.length        ?? 0,
      purchases:     data.purchases?.length    ?? 0,
      inventory:     data.inventory?.length    ?? 0,
      parties:       data.parties?.length      ?? 0,
      expenses:      data.expenses?.length     ?? 0,
      payments:      data.payments?.length     ?? 0,
      generalLedger: data.generalLedger?.length ?? 0,
    };
  } catch {
    return null;
  }
}
