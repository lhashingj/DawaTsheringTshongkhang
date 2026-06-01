'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AccountingNav } from '@/components/accounting/AccountingNav';
import { CashBook } from '@/components/accounting/CashBook';
import { CustomerReturns } from '@/components/accounting/CustomerReturns';
import { SupplierReturns } from '@/components/accounting/SupplierReturns';
import { BookOpen, RotateCcw, PackageX } from 'lucide-react';

type Tab = 'cashbook' | 'customer-returns' | 'supplier-returns';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'cashbook',          label: 'Cash Book',         icon: BookOpen    },
  { id: 'customer-returns',  label: 'Customer Returns',  icon: RotateCcw   },
  { id: 'supplier-returns',  label: 'Supplier Returns',  icon: PackageX    },
];

function CashPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>('cashbook');

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
        {tab === 'cashbook'         && <CashBook />}
        {tab === 'customer-returns' && <CustomerReturns />}
        {tab === 'supplier-returns' && <SupplierReturns />}
      </div>
    </>
  );
}

export default function CashPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      <AccountingNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold">Cash Book & Returns</h1>
          <p className="text-slate-400 text-sm mt-1">
            Track liquid cash flows with printable vouchers, and manage{' '}
            <span className="text-orange-400 font-medium">Customer Returns</span> (credit notes) and{' '}
            <span className="text-orange-400 font-medium">Supplier Returns</span> (debit notes) with
            automatic GL reversal and inventory adjustment.
          </p>
        </div>
        <Suspense fallback={
          <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6 animate-pulse">
            {TABS.map(t => <div key={t.id} className="flex-1 h-10 bg-slate-700 rounded-lg" />)}
          </div>
        }>
          <CashPageContent />
        </Suspense>
      </div>
    </div>
  );
}
