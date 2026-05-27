'use client';

import { useState, useEffect, useRef } from 'react';
import { CloudUpload, CloudOff, Loader2, Check, CloudDownload, AlertCircle } from 'lucide-react';
import { backupToSupabase, restoreFromSupabase, getCloudRecordCounts, LAST_BACKUP_KEY } from '@/lib/accounting-sync';

export function BackupButton() {
  const [status, setStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [isOnline, setIsOnline] = useState(true);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const stored = localStorage.getItem(LAST_BACKUP_KEY);
    if (stored) setLastBackup(stored);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const openMenu = () => {
    if (!isOnline || status !== 'idle') return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setShowMenu(v => !v);
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
      ' ' + d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  };

  const run = async (action: 'backup' | 'restore') => {
    setShowMenu(false);
    if (!isOnline || status === 'busy') return;

    if (action === 'restore') {
      const cloudCounts = await getCloudRecordCounts();
      if (!cloudCounts || (cloudCounts.sales === 0 && cloudCounts.purchases === 0 && cloudCounts.inventory === 0)) {
        setErrorMsg('No cloud data found. Backup first from your main device.');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 4000);
        return;
      }
      const ok = window.confirm(
        `Restore from cloud?\n\nThis will REPLACE your local data with cloud data:\n` +
        `• ${cloudCounts.sales} invoices\n• ${cloudCounts.purchases} purchases\n• ${cloudCounts.inventory} inventory items\n\nContinue?`
      );
      if (!ok) return;
    }

    setStatus('busy');
    setErrorMsg('');
    try {
      if (action === 'backup') {
        await backupToSupabase();
        setLastBackup(new Date().toISOString());
      } else {
        await restoreFromSupabase();
      }
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Operation failed');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <div className="flex items-center gap-2 ml-2">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-green-400' : 'bg-slate-500'}`}
        title={isOnline ? 'Online' : 'Offline'}
      />

      <button
        ref={btnRef}
        onClick={openMenu}
        disabled={!isOnline || status === 'busy'}
        title={
          !isOnline ? 'Offline' :
          lastBackup ? `Last backup: ${fmtTime(lastBackup)}` :
          'Cloud sync'
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
          status === 'success' ? 'bg-green-600/20 text-green-400' :
          status === 'error' ? 'bg-red-600/20 text-red-400' :
          !isOnline ? 'bg-slate-700/40 text-slate-500 cursor-not-allowed' :
          'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
        }`}
      >
        {status === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
         status === 'success' ? <Check className="w-3.5 h-3.5" /> :
         status === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
         !isOnline ? <CloudOff className="w-3.5 h-3.5" /> :
         <CloudUpload className="w-3.5 h-3.5" />}
        {status === 'busy' ? 'Working…' :
         status === 'success' ? 'Done!' :
         status === 'error' ? 'Failed' :
         'Cloud'}
      </button>

      {/* Dropdown — rendered fixed to escape nav overflow clipping */}
      {showMenu && menuPos && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowMenu(false)} />
          <div
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden w-52"
          >
            <button
              onClick={() => run('backup')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
            >
              <CloudUpload className="w-4 h-4 text-orange-400 shrink-0" />
              <div>
                <div className="font-medium">Backup to Cloud</div>
                <div className="text-xs text-slate-500">
                  {lastBackup ? `Last: ${fmtTime(lastBackup)}` : 'Never backed up'}
                </div>
              </div>
            </button>
            <div className="border-t border-slate-700" />
            <button
              onClick={() => run('restore')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
            >
              <CloudDownload className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <div className="font-medium">Restore from Cloud</div>
                <div className="text-xs text-slate-500">Load data to this device</div>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Error tooltip — also fixed */}
      {status === 'error' && errorMsg && (
        <div
          style={{ position: 'fixed', top: (menuPos?.top ?? 60), right: (menuPos?.right ?? 8), zIndex: 9999 }}
          className="bg-red-900/90 border border-red-700 rounded-lg px-3 py-2 text-xs text-red-300 max-w-xs"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
