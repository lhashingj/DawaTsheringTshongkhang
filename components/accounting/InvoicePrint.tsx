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
            padding: 28px 32px !important;
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
        <div className="text-center border-b-2 border-black pb-3 mb-3">
          <div className="flex justify-between items-start">
            <div className="text-left">
              <p className="text-[10px]">1.0 / GROSS v2.0</p>
            </div>
            <div className="text-right text-[10px]">Page 1 of 1</div>
          </div>
          <h1 className="text-[15px] font-bold mt-1">
            {BIZ.name} , {BIZ.location}.{BIZ.year},
          </h1>
          <div className="flex justify-between items-center mt-0.5">
            <div className="text-left">
              <p className="font-bold">{BIZ.country}</p>
              <p>
                GST certified agent NO. {BIZ.gstNo}, TPN: {BIZ.tpn}/LIC No.{' '}
                {BIZ.licNo}
              </p>
              <p>{BIZ.phone}/</p>
            </div>
            <div className="text-right font-bold text-[14px] border border-black px-2 py-1">
              INVOICE
            </div>
          </div>
        </div>

        {/* ── Date & Invoice No ── */}
        <div className="flex justify-between mb-3">
          <div />
          <div className="text-right space-y-0.5">
            <div>
              <span className="font-bold">Date.</span> {fmtDate(invoice.timestamp)}
            </div>
            <div>
              <span className="font-bold">Invoice No.</span> {invoice.invoiceNo}
            </div>
          </div>
        </div>

        {/* ── To ── */}
        <div className="mb-3">
          <span className="font-bold">To</span>
          {invoice.customerName && (
            <div className="ml-4 mt-0.5">
              <p>{invoice.customerName}</p>
              {invoice.customerAddress && <p>{invoice.customerAddress}</p>}
              {invoice.customerPhone && <p>Ph: {invoice.customerPhone}</p>}
              {invoice.customerTPN && <p>TPN: {invoice.customerTPN}</p>}
            </div>
          )}
        </div>

        {/* ── Items Table ── */}
        <table className="w-full border-collapse text-[11px] mb-2">
          <thead>
            <tr>
              <th className="border border-black px-1.5 py-1 text-left w-8">SL</th>
              <th className="border border-black px-1.5 py-1 text-left">Description</th>
              <th className="border border-black px-1.5 py-1 text-right w-24">Qty Unit</th>
              <th className="border border-black px-1.5 py-1 text-right w-20">Rate</th>
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
                  {item.rate.toFixed(2)}
                </td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {item.amount.toFixed(2)}
                </td>
              </tr>
            ))}
            {/* Spacer rows for short invoices */}
            {invoice.items.length < 4 &&
              Array.from({ length: 4 - invoice.items.length }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-black px-1.5 py-1">&nbsp;</td>
                  <td className="border border-black px-1.5 py-1">&nbsp;</td>
                  <td className="border border-black px-1.5 py-1">&nbsp;</td>
                  <td className="border border-black px-1.5 py-1">&nbsp;</td>
                  <td className="border border-black px-1.5 py-1">&nbsp;</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="border border-black px-1.5 py-1" />
              <td className="border border-black px-1.5 py-1 italic">Gross Amount</td>
              <td className="border border-black px-1.5 py-1 text-right">
                {invoice.grossAmount.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black px-1.5 py-1" />
              <td className="border border-black px-1.5 py-1">
                GST {invoice.gstRate.toFixed(2)}%
              </td>
              <td className="border border-black px-1.5 py-1 text-right">
                {invoice.gstAmount.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black px-1.5 py-1 italic text-[10px]">
                {numberToWords(invoice.netAmount)}
              </td>
              <td className="border border-black px-1.5 py-1 font-bold">Net Amount</td>
              <td className="border border-black px-1.5 py-1 text-right font-bold">
                {invoice.netAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── Terms ── */}
        <div className="mt-4 border-t border-black pt-2">
          <div className="flex justify-between">
            <span className="font-bold">Terms &amp; Conditions:</span>
            <span className="italic">E. &amp; O. E.</span>
          </div>

          <div className="flex justify-end mt-10 mb-2">
            <span className="font-bold border-t border-black pt-1 pr-8">Authorized Signatory</span>
          </div>

          <div className="text-[10px] mt-3 space-y-1">
            <p>
              we declare that this invoice shows the actual price of the goods described and that
              all particulars are true and correct. Goods once sold will not be taken back.
            </p>
            <p>
              payment penalty of @ 20% will be charges if the payment is not made within one month
              stipulated time. Subject to Paro court of justice.
            </p>
            <p className="mt-2">
              Bank details: Please while making payment kindly reflect invoice number in description.
            </p>
            <p className="mt-1">{BIZ.bank}</p>
          </div>
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
