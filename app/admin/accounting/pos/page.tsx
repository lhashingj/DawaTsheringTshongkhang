import { AccountingNav } from '@/components/accounting/AccountingNav';
import { POSCheckout } from '@/components/accounting/POSCheckout';

export const metadata = { title: 'Point of Sale | DTT Accounting', robots: 'noindex,nofollow' };

export default function POSPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      <AccountingNav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold">Point of Sale</h1>
          <p className="text-slate-400 text-sm mt-1">
            Create an invoice, save it to the ledger, and print a clean receipt.
          </p>
        </div>
        <POSCheckout />
      </div>
    </div>
  );
}
