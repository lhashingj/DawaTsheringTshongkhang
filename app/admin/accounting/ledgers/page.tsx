'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AccountingNav } from '@/components/accounting/AccountingNav';
import { SalesLedger } from '@/components/accounting/SalesLedger';
import { PurchaseLedger } from '@/components/accounting/PurchaseLedger';
import { PartyLedger } from '@/components/accounting/PartyLedger';
import { InventoryManager } from '@/components/accounting/InventoryManager';
import { Receipt, ShoppingBag, Users, Package } from 'lucide-react';

type Tab = 'sales' | 'purchases' | 'parties' | 'inventory';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'sales', label: 'Sales Ledger', icon: Receipt },
  { id: 'purchases', label: 'Purchase Ledger', icon: ShoppingBag },
  { id: 'parties', label: 'Party Directory', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Package },
];

function LedgersContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>('sales');

  useEffect(() => {
    if (tabParam && TABS.some(t => t.id === tabParam)) setTab(tabParam);
  }, [tabParam]);

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
              tab === id
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'sales' && <SalesLedger />}
        {tab === 'purchases' && <PurchaseLedger />}
        {tab === 'parties' && <PartyLedger />}
        {tab === 'inventory' && <InventoryManager />}
      </div>
    </>
  );
}

export default function LedgersPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      <AccountingNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold">Ledgers</h1>
          <p className="text-slate-400 text-sm mt-1">Full CRUD management for all accounting records.</p>
        </div>
        <Suspense fallback={
          <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6 animate-pulse">
            {TABS.map(t => <div key={t.id} className="flex-1 h-10 bg-slate-700 rounded-lg" />)}
          </div>
        }>
          <LedgersContent />
        </Suspense>
      </div>
    </div>
  );
}
