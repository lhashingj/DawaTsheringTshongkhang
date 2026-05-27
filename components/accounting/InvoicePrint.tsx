'use client';

import { SaleRecord } from '@/lib/accounting-db';
import { numberToWords } from '@/lib/number-to-words';
import { Printer, X } from 'lucide-react';

const BIZ = {
  name: 'DAWA TSHERING SHOP',
  location: 'Paro',
  country: 'PARO, BHUTAN',
  year: new Date().getFullYear(),
  gstNo: 'P10037232',
  tpn: 'JAB09739',
  licNo: 'R1005542',
  phone: '17716895 / 17711469',
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
          #dtt-invoice-print, #dtt-invoice-print * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #dtt-invoice-print {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 24px 32px !important;
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
            padding: 5px 8px !important;
          }
          #dtt-invoice-print th {
            background: #e8e8e8 !important;
            font-weight: 800 !important;
            font-size: 12px !important;
          }
          #dtt-invoice-print .inv-label {
            font-weight: 700 !important;
          }
          #dtt-invoice-print .inv-total-row td {
            font-weight: 700 !important;
            font-size: 13px !important;
          }
          .no-print { display: none !important; }
          @page { margin: 0.6cm; size: A4; }
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
        className="bg-white text-black p-6 max-w-[720px] mx-auto"
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.5,
          color: '#000',
        }}
      >
        {/* ── Header ── */}
        <div className="relative text-center pb-3 mb-2" style={{ borderBottom: '2.5px solid #000' }}>
          {/* Logo top-left */}
          <div className="absolute top-0 left-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DTT Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
          </div>

          {/* INVOICE badge + date top-right */}
          <div className="absolute top-0 right-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <div
              style={{
                border: '2px solid #000',
                padding: '4px 14px',
                fontWeight: 900,
                fontSize: '14px',
                letterSpacing: '0.05em',
              }}
            >
              INVOICE
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, textAlign: 'right', lineHeight: 1.7 }}>
              <div><span style={{ fontWeight: 700 }}>Date:&nbsp;</span>{fmtDate(invoice.timestamp)}</div>
              <div><span style={{ fontWeight: 700 }}>Invoice No.:&nbsp;</span>{invoice.invoiceNo}</div>
            </div>
          </div>

          <div style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.2 }}>
            ཟླ་བ་ཚེ་རིང་ཚོང་ཁང་།
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.2, marginTop: '2px' }}>
            {BIZ.name}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
            {BIZ.country}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '3px' }}>
            GST Certified Agent No.&nbsp;{BIZ.gstNo} &nbsp;|&nbsp; TPN:&nbsp;{BIZ.tpn} &nbsp;|&nbsp; LIC No.&nbsp;{BIZ.licNo}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '1px' }}>
            Ph:&nbsp;{BIZ.phone}
          </div>
        </div>

        {/* ── To ── */}
        <div style={{ marginBottom: '12px', fontSize: '13px' }}>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ border: '1.5px solid #000', padding: '6px 8px', textAlign: 'center', background: '#e8e8e8', fontWeight: 800, width: '36px' }}>SL</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 8px', textAlign: 'left', background: '#e8e8e8', fontWeight: 800 }}>Description of Goods</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 8px', textAlign: 'right', background: '#e8e8e8', fontWeight: 800, width: '90px' }}>Qty / Unit</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 8px', textAlign: 'right', background: '#e8e8e8', fontWeight: 800, width: '90px' }}>Rate (Nu.)</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 8px', textAlign: 'right', background: '#e8e8e8', fontWeight: 800, width: '100px' }}>Amount (Nu.)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ border: '1.5px solid #000', padding: '5px 8px', fontWeight: 600 }}>{item.description}</td>
                <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                  {item.qty.toFixed(2)}&nbsp;{item.unit}
                </td>
                <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                  {fmtNum(item.rate)}
                </td>
                <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                  {fmtNum(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ border: '1.5px solid #000', padding: '5px 8px' }} />
              <td style={{ border: '1.5px solid #000', padding: '5px 8px', fontWeight: 700 }}>Gross Amount</td>
              <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>
                {fmtNum(invoice.grossAmount)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ border: '1.5px solid #000', padding: '5px 8px' }} />
              <td style={{ border: '1.5px solid #000', padding: '5px 8px', fontWeight: 700 }}>
                GST {invoice.gstRate.toFixed(2)}%
              </td>
              <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>
                {fmtNum(invoice.gstAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── Net Amount ── */}
        <div
          className="inv-total-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2.5px solid #000',
            borderTop: '2.5px solid #000',
            padding: '7px 0',
            marginTop: '-1px',
            marginBottom: '14px',
          }}
        >
          <span style={{ fontStyle: 'italic', fontSize: '11px', fontWeight: 600, flex: 1, paddingRight: '16px' }}>
            {numberToWords(invoice.netAmount)}
          </span>
          <div style={{ display: 'flex', gap: '32px', fontWeight: 900, fontSize: '14px', whiteSpace: 'nowrap' }}>
            <span>Net Amount</span>
            <span>Nu.&nbsp;{fmtNum(invoice.netAmount)}</span>
          </div>
        </div>

        {/* ── Terms & Footer ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span
              style={{
                border: '1px dashed #000',
                padding: '3px 10px',
                fontWeight: 800,
                fontSize: '12px',
              }}
            >
              Terms &amp; Conditions:
            </span>
            <span style={{ fontStyle: 'italic', fontSize: '12px', fontWeight: 600 }}>E. &amp; O. E.</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, lineHeight: 1.6, flex: 1 }}>
              <p>
                We declare that this invoice shows the actual price of the goods described and that all
                particulars are true and correct. Goods once sold will not be taken back.
              </p>
              <p style={{ marginTop: '4px' }}>
                Payment penalty of 20% will be charged if payment is not made within one month.
                Subject to Paro Court of Justice.
              </p>
              <p style={{ marginTop: '8px', fontWeight: 700 }}>
                Bank Details:&nbsp;{BIZ.bank}&nbsp;— Please include invoice number in payment reference.
              </p>
            </div>
            <div style={{ fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap', paddingTop: '8px' }}>
              Authorized Signatory
            </div>
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
