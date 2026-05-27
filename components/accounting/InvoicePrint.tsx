'use client';

import { SaleRecord } from '@/lib/accounting-db';
import { numberToWords } from '@/lib/number-to-words';
import { Printer, X } from 'lucide-react';

const BIZ = {
  name: 'DAWA TSHERING SHOP',
  location: 'Paro',
  country: 'PARO BHUTAN',
  year: new Date().getFullYear(),
  gstNo: 'P10037232',
  tpn: 'JAB09739',
  licNo: 'R1005542',
  phone: '17716895/17711469',
  bank: 'BOB: 225667231',
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtNum(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  invoice: SaleRecord;
  onClose?: () => void;
  embedded?: boolean;
}

export function InvoicePrint({ invoice, onClose, embedded = false }: Props) {
  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #dtt-invoice-print, #dtt-invoice-print * { visibility: visible !important; }
          #dtt-invoice-print {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 28px 36px !important;
            background: white !important;
            font-family: 'Courier New', Courier, monospace !important;
          }
          .no-print { display: none !important; }
          @page { margin: 0.5cm; size: A4; }
        }
      `}</style>

      {!embedded && (
        <div className="no-print flex items-center justify-between mb-4 px-4 pt-4">
          <h2 className="text-lg font-bold text-white">Invoice #{invoice.invoiceNo}</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            )}
          </div>
        </div>
      )}

      <div
        id="dtt-invoice-print"
        className="bg-white text-black p-6 font-mono text-[11px] leading-snug max-w-[720px] mx-auto"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* ── Header ── */}
        <div className="relative text-center border-b-2 border-black pb-2 mb-1">
          {/* INVOICE box pinned top-right */}
          <div
            className="absolute top-0 right-0 font-bold text-[13px]"
            style={{ border: '2px solid black', padding: '3px 10px' }}
          >
            INVOICE
          </div>

          <h1 className="text-[15px] font-bold leading-tight">
            {BIZ.name} , {BIZ.location}.{BIZ.year},
          </h1>
          <p className="font-bold">{BIZ.country}</p>
          <p>
            GST certified agent NO. {BIZ.gstNo}, TPN: {BIZ.tpn}/LIC No. {BIZ.licNo}
          </p>
          <p>{BIZ.phone}/</p>
        </div>

        {/* ── Date & Invoice No ── */}
        <div className="text-right mb-2 space-y-0.5">
          <div>
            <span className="font-bold">Date.</span> {fmtDate(invoice.timestamp)}
          </div>
          <div>
            <span className="font-bold">Invoice No.</span> {invoice.invoiceNo}
          </div>
        </div>

        {/* ── To ── */}
        <div className="mb-3">
          <span className="font-bold">To</span>
          {invoice.customerName && invoice.customerName !== 'Cash Customer' && (
            <div className="ml-4 mt-0.5">
              <p>{invoice.customerName}</p>
              {invoice.customerAddress && <p>{invoice.customerAddress}</p>}
              {invoice.customerPhone && <p>Ph: {invoice.customerPhone}</p>}
              {invoice.customerTPN && <p>TPN: {invoice.customerTPN}</p>}
            </div>
          )}
        </div>

        {/* ── Items Table ── */}
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border border-black px-1.5 py-1 text-left w-8">SL</th>
              <th className="border border-black px-1.5 py-1 text-left">Description</th>
              <th className="border border-black px-1.5 py-1 text-right w-24">Qty Unit</th>
              <th className="border border-black px-1.5 py-1 text-right w-24">Rate</th>
              <th className="border border-black px-1.5 py-1 text-right w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td className="border border-black px-1.5 py-1 text-center">{i + 1}</td>
                <td className="border border-black px-1.5 py-1">{item.description}</td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {item.qty.toFixed(2)} {item.unit}
                </td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {fmtNum(item.rate)}
                </td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {fmtNum(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="border border-black px-1.5 py-1" />
              <td className="border border-black px-1.5 py-1 italic">Gross Amount</td>
              <td className="border border-black px-1.5 py-1 text-right">
                {fmtNum(invoice.grossAmount)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black px-1.5 py-1" />
              <td className="border border-black px-1.5 py-1">
                GST {invoice.gstRate.toFixed(2)}%
              </td>
              <td className="border border-black px-1.5 py-1 text-right">
                {fmtNum(invoice.gstAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── Net Amount row (below table, matching image layout) ── */}
        <div className="flex justify-between items-center border-b border-black py-1 mb-3">
          <span className="italic text-[10px]">{numberToWords(invoice.netAmount)}</span>
          <div className="flex items-center gap-6 font-bold text-[11px]">
            <span>Net Amount</span>
            <span>{fmtNum(invoice.netAmount)}</span>
          </div>
        </div>

        {/* ── Terms & Conditions ── */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span
              className="font-bold text-[11px]"
              style={{ border: '1px dashed black', padding: '2px 8px' }}
            >
              Terms &amp; Conditions:
            </span>
            <span className="italic text-[11px]">E. &amp; O. E.</span>
          </div>
          <p className="text-[9px] mb-2">.</p>

          {/* Declaration + Authorized Signatory side by side */}
          <div className="flex justify-between items-start gap-4">
            <div className="text-[10px] space-y-1 flex-1">
              <p>
                we declare that this invoice shows the actual price of the goods described and that all
                particulars are true and correct. Goods once sold will not be taken back.
              </p>
              <p>
                payment penalety of @ 20% will be charges if the payment is not made within one month
                stipulated time.Subject to Paro court of justic.
              </p>
              <p className="mt-2">
                Bank details: Please while making payment kindly reflect invoice number in description .
              </p>
            </div>
            <div className="font-bold text-[11px] whitespace-nowrap">Authorized Signatory</div>
          </div>

          <p className="text-[10px] mt-3">{BIZ.bank}</p>
        </div>
      </div>

      {embedded && (
        <div className="no-print flex gap-2 mt-4 px-4 pb-4">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      )}
    </>
  );
}
