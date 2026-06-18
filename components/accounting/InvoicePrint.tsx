'use client';

import { useEffect, useState } from 'react';
import { SaleRecord } from '@/lib/accounting-db';
import { numberToWords } from '@/lib/number-to-words';
import { Printer, X, Pencil, Check } from 'lucide-react';

const BIZ = {
  name: 'DAWA TSHERING SHOP',
  location: 'Paro',
  country: 'PARO, BHUTAN',
  year: new Date().getFullYear(),
  gstNo: 'P10037232',
  tpn: 'JAB09739',
  licNo: 'R1005542',
  phone: '17716895 / 17711469',
  website: 'www.dawatsheringshop.com',
};

const DEFAULT_BOB = '225667231';

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
  const [bobAccount, setBobAccount] = useState(DEFAULT_BOB);
  const [editingBank, setEditingBank] = useState(false);
  const [bankInput, setBankInput] = useState(DEFAULT_BOB);

  useEffect(() => {
    const saved = localStorage.getItem('dtt-bob-account');
    if (saved) { setBobAccount(saved); setBankInput(saved); }
  }, []);

  function saveBank() {
    const trimmed = bankInput.trim();
    if (trimmed) {
      localStorage.setItem('dtt-bob-account', trimmed);
      setBobAccount(trimmed);
    }
    setEditingBank(false);
  }

  const handlePrint = () => window.print();

  const controls = (
    <div className="no-print flex items-center gap-2 flex-wrap">
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <Printer className="w-4 h-4" />
        Print Invoice
      </button>

      {/* BOB account editor */}
      {editingBank ? (
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-sm">BOB:</span>
          <input
            type="text"
            value={bankInput}
            onChange={e => setBankInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveBank(); if (e.key === 'Escape') setEditingBank(false); }}
            autoFocus
            className="bg-slate-700 border border-slate-500 text-white text-sm rounded px-2 py-1 w-36 focus:outline-none focus:border-orange-500"
            placeholder="Account number"
          />
          <button
            onClick={saveBank}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={() => setEditingBank(false)}
            className="text-slate-400 hover:text-white px-2 py-1.5 rounded text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditingBank(true)}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          title="Change BOB account number shown on invoices"
        >
          <Pencil className="w-3.5 h-3.5" />
          BOB: {bobAccount}
        </button>
      )}

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
  );

  return (
    <>
      <style>{`
        @media print {
          /*
           * Collapse hidden elements to zero height so the browser does not
           * generate extra blank pages for the rest of the accounting UI.
           * position:fixed removes the invoice from normal flow, so overflow:hidden
           * on ancestors does NOT clip it.
           */
          body > * {
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          #dtt-invoice-print,
          #dtt-invoice-print * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #dtt-invoice-print {
            position: fixed !important;
            inset: 0 !important;
            height: auto !important;
            overflow: visible !important;
            width: 100% !important;
            padding: 14px 20px !important;
            background: white !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-weight: 500 !important;
            color: #000 !important;
          }
          #dtt-invoice-print table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          #dtt-invoice-print th,
          #dtt-invoice-print td {
            border: 1.5px solid #000 !important;
            padding: 3px 6px !important;
          }
          #dtt-invoice-print th {
            background: #e8e8e8 !important;
            font-weight: 800 !important;
            font-size: 11px !important;
          }
          #dtt-invoice-print .inv-label { font-weight: 700 !important; }
          #dtt-invoice-print .inv-total-row td {
            font-weight: 700 !important;
            font-size: 12px !important;
          }
          .no-print { display: none !important; }
          @page { margin: 0.4cm; size: A4; }
        }
      `}</style>

      {!embedded && (
        <div className="no-print flex items-center justify-between mb-4 px-4 pt-4 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-white">Invoice #{invoice.invoiceNo}</h2>
          {controls}
        </div>
      )}

      <div
        id="dtt-invoice-print"
        className="bg-white text-black p-4 max-w-[720px] mx-auto"
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          lineHeight: 1.4,
          color: '#000',
        }}
      >
        {/* ── Header ── */}
        <div className="relative text-center pb-2 mb-1" style={{ borderBottom: '2px solid #000' }}>
          <div className="absolute top-0 left-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DTT Logo" style={{ width: '72px', height: '72px', objectFit: 'contain' }} />
          </div>

          <div className="absolute top-0 right-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ border: '2px solid #000', padding: '3px 10px', fontWeight: 900, fontSize: '13px', letterSpacing: '0.05em' }}>
              INVOICE
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, textAlign: 'right', lineHeight: 1.6 }}>
              <div><span style={{ fontWeight: 700 }}>Date:&nbsp;</span>{fmtDate(invoice.timestamp)}</div>
              <div><span style={{ fontWeight: 700 }}>Invoice No.:&nbsp;</span>{invoice.invoiceNo}</div>
            </div>
          </div>

          <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.1 }}>
            ཟླ་བ་ཚེ་རིང་ཚོང་ཁང་།
          </div>
          <div style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.2, marginTop: '1px' }}>
            {BIZ.name}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '1px' }}>
            {BIZ.country}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 600, marginTop: '2px' }}>
            GST Certified Agent No.&nbsp;{BIZ.gstNo} &nbsp;|&nbsp; TPN:&nbsp;{BIZ.tpn} &nbsp;|&nbsp; LIC No.&nbsp;{BIZ.licNo}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 600, marginTop: '1px' }}>
            Ph:&nbsp;{BIZ.phone} &nbsp;|&nbsp; {BIZ.website}
          </div>
        </div>

        {/* ── To ── */}
        <div style={{ marginBottom: '6px', fontSize: '12px' }}>
          <span className="inv-label" style={{ fontWeight: 700 }}>To:&nbsp;</span>
          {invoice.customerName && invoice.customerName !== 'Cash Customer' ? (
            <span style={{ fontWeight: 600 }}>{invoice.customerName}</span>
          ) : (
            <span style={{ fontWeight: 600 }}>Cash Customer</span>
          )}
          {invoice.customerAddress && (
            <div style={{ marginLeft: '28px', marginTop: '2px' }}>{invoice.customerAddress}</div>
          )}
          {invoice.customerPhone && (
            <div style={{ marginLeft: '28px' }}>Ph: {invoice.customerPhone}</div>
          )}
          {invoice.customerTPN && (
            <div style={{ marginLeft: '28px' }}>TPN: {invoice.customerTPN}</div>
          )}
        </div>

        {/* ── Items Table ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'center', background: '#e8e8e8', fontWeight: 800, width: '32px' }}>SL</th>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'left', background: '#e8e8e8', fontWeight: 800 }}>Description of Goods</th>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', background: '#e8e8e8', fontWeight: 800, width: '80px' }}>Qty / Unit</th>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', background: '#e8e8e8', fontWeight: 800, width: '80px' }}>Rate (Nu.)</th>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', background: '#e8e8e8', fontWeight: 800, width: '90px' }}>Amount (Nu.)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ border: '1.5px solid #000', padding: '3px 6px', fontWeight: 600 }}>{item.description}</td>
                <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>
                  {item.qty.toFixed(2)}&nbsp;{item.unit}
                </td>
                <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>
                  {fmtNum(item.rate)}
                </td>
                <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>
                  {fmtNum(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ border: '1.5px solid #000', padding: '3px 6px' }} />
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', fontWeight: 700 }}>Gross Amount</td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>
                {fmtNum(invoice.grossAmount)}
              </td>
            </tr>
            {invoice.gstRate > 0 && (
              <tr>
                <td colSpan={3} style={{ border: '1.5px solid #000', padding: '3px 6px' }} />
                <td style={{ border: '1.5px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                  GST {invoice.gstRate.toFixed(2)}%
                </td>
                <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>
                  {fmtNum(invoice.gstAmount)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* ── Net Amount ── */}
        <div
          className="inv-total-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #000',
            borderTop: '2px solid #000',
            padding: '5px 0',
            marginTop: '-1px',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontStyle: 'italic', fontSize: '10px', fontWeight: 600, flex: 1, paddingRight: '12px' }}>
            {numberToWords(invoice.netAmount)}
          </span>
          <div style={{ display: 'flex', gap: '24px', fontWeight: 900, fontSize: '13px', whiteSpace: 'nowrap' }}>
            <span>Net Amount</span>
            <span>Nu.&nbsp;{fmtNum(invoice.netAmount)}</span>
          </div>
        </div>

        {/* ── Terms & Footer ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ border: '1px dashed #000', padding: '2px 8px', fontWeight: 800, fontSize: '11px' }}>
              Terms &amp; Conditions:
            </span>
            <span style={{ fontStyle: 'italic', fontSize: '11px', fontWeight: 600 }}>E. &amp; O. E.</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
              <p>
                We declare that this invoice shows the actual price of the goods described and that all
                particulars are true and correct. Goods once sold will not be taken back.
              </p>
              <p style={{ marginTop: '2px' }}>
                Payment penalty of 20% will be charged if payment is not made within one month.
                Subject to Paro Court of Justice.
              </p>
              <p style={{ marginTop: '4px', fontWeight: 700 }}>
                Bank Details:&nbsp;BOB:&nbsp;{bobAccount}&nbsp;— Please include invoice number in payment reference.
              </p>
            </div>
            <div style={{ fontWeight: 800, fontSize: '12px', whiteSpace: 'nowrap', paddingTop: '4px' }}>
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {embedded && (
        <div className="no-print flex gap-2 mt-4 px-4 pb-4 flex-wrap items-center">
          {controls}
        </div>
      )}
    </>
  );
}
