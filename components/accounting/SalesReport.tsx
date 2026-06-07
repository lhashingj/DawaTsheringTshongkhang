'use client';

import { useState, useEffect, useCallback } from 'react';
import { salesCRUD, creditNoteCRUD } from '@/lib/accounting-db';
import type { SaleRecord, CreditNote } from '@/lib/accounting-db';
import { FileText, Printer, RotateCcw } from 'lucide-react';

// ── Business constants ────────────────────────────────────────────────────────
const BIZ_NAME = 'DAWA TSHERING SHOP , Paro.2026,';
const BIZ_SUB  = 'PARO BHUTAN GST certified agent NO. P10037232,   TPN: JAB09739/LIC No. R1005542';

// ── Toggle key types ──────────────────────────────────────────────────────────
type LeftKey  = 'Date' | 'Product' | 'Group' | 'Category' | 'Party' | 'Party Group' | 'Party Category' | 'Agent' | 'User';
type RightKey = 'Doc No' | 'Party' | 'Product' | 'Category' | 'Group' | 'Agent' | 'Ledger' | 'User';

const LEFT_KEYS:  LeftKey[]  = ['Date', 'Product', 'Group', 'Category', 'Party', 'Party Group', 'Party Category', 'Agent', 'User'];
const RIGHT_KEYS: RightKey[] = ['Doc No', 'Party', 'Product', 'Category', 'Group', 'Agent', 'Ledger', 'User'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDateDisp(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtCell(n: number) { return n === 0 ? '-' : n.toFixed(2); }
function fmtFixed(n: number) { return n.toFixed(2); }
function dateKeyOf(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function parseKey(k: string): Date {
  const [d, m, y] = k.split('/').map(Number);
  return new Date(y, m - 1, d);
}
function thisMonthStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0];
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function printedNow() {
  const n = new Date();
  const date = n.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}
function autoHeading(left: LeftKey, right: RightKey): string {
  if (right === 'Doc No') return `Sale Bill ${left} Wise`;
  return `Sale Bill ${left} Wise ${right} Wise`;
}

// ── Report data types ─────────────────────────────────────────────────────────
interface LineItem { description: string; qty: number; unit: string; rate: number; gross: number; tax: number; net: number; }
interface InvoiceRow { docNo: string; partyName: string; gross: number; disc: number; taxable: number; tax: number; term: number; net: number; items: LineItem[]; }
interface DayTotals { gross: number; disc: number; taxable: number; tax: number; term: number; net: number; }
interface DayGroup { dateStr: string; invoices: InvoiceRow[]; totals: DayTotals; }

interface ProductRow { description: string; totalQty: number; unit: string; rate: number; gross: number; disc: number; taxable: number; tax: number; net: number; }
interface ProductDayGroup { dateStr: string; products: ProductRow[]; totals: Omit<DayTotals, 'term'>; }

interface PartyGroup { partyName: string; invoices: InvoiceRow[]; totals: DayTotals; }

// ── Report builders ───────────────────────────────────────────────────────────
function buildDatePartyWise(sales: SaleRecord[], cns: CreditNote[], withReturns: boolean): DayGroup[] {
  const dayMap = new Map<string, InvoiceRow[]>();

  for (const sale of [...sales].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))) {
    const dk = dateKeyOf(sale.timestamp);
    if (!dayMap.has(dk)) dayMap.set(dk, []);
    const term = sale.netAmount - sale.grossAmount - sale.gstAmount;
    dayMap.get(dk)!.push({
      docNo: sale.invoiceNo,
      partyName: sale.customerName || 'Cash Customer',
      gross: sale.grossAmount, disc: 0, taxable: sale.grossAmount,
      tax: sale.gstAmount, term, net: sale.netAmount,
      items: sale.items.map(it => {
        const tax = Math.round(it.amount * (sale.gstRate || 5)) / 100;
        return { description: it.description, qty: it.qty, unit: it.unit, rate: it.rate, gross: it.amount, tax, net: it.amount + tax };
      }),
    });
  }

  if (withReturns) {
    for (const cn of [...cns].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))) {
      const dk = dateKeyOf(cn.timestamp);
      if (!dayMap.has(dk)) dayMap.set(dk, []);
      dayMap.get(dk)!.push({
        docNo: cn.creditNoteNo,
        partyName: cn.partyName,
        gross: -cn.grossAmount, disc: 0, taxable: -cn.grossAmount,
        tax: -cn.gstAmount, term: 0, net: -cn.netAmount,
        items: cn.items.map(it => {
          const tax = Math.round(it.amount * (cn.gstRate || 5)) / 100;
          return { description: it.description, qty: -it.qty, unit: it.unit, rate: it.rate, gross: -it.amount, tax: -tax, net: -(it.amount + tax) };
        }),
      });
    }
  }

  return [...dayMap.entries()]
    .map(([dateStr, invoices]) => ({
      dateStr, invoices,
      totals: invoices.reduce<DayTotals>((a, inv) => ({
        gross: a.gross + inv.gross, disc: a.disc + inv.disc, taxable: a.taxable + inv.taxable,
        tax: a.tax + inv.tax, term: a.term + inv.term, net: a.net + inv.net,
      }), { gross: 0, disc: 0, taxable: 0, tax: 0, term: 0, net: 0 }),
    }))
    .sort((a, b) => parseKey(a.dateStr).getTime() - parseKey(b.dateStr).getTime());
}

function buildDateProductWise(sales: SaleRecord[], cns: CreditNote[], withReturns: boolean): ProductDayGroup[] {
  type Acc = { qty: number; unit: string; rate: number; amount: number; tax: number };
  const dayMap = new Map<string, Map<string, Acc>>();

  for (const sale of [...sales].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))) {
    const dk = dateKeyOf(sale.timestamp);
    if (!dayMap.has(dk)) dayMap.set(dk, new Map());
    const pm = dayMap.get(dk)!;
    for (const it of sale.items) {
      const key = `${it.description}|||${it.unit}`;
      const tax = Math.round(it.amount * (sale.gstRate || 5)) / 100;
      if (!pm.has(key)) pm.set(key, { qty: 0, unit: it.unit, rate: it.rate, amount: 0, tax: 0 });
      const p = pm.get(key)!;
      p.qty += it.qty; p.amount += it.amount; p.tax += tax; p.rate = it.rate;
    }
  }

  if (withReturns) {
    for (const cn of cns) {
      const dk = dateKeyOf(cn.timestamp);
      if (!dayMap.has(dk)) dayMap.set(dk, new Map());
      const pm = dayMap.get(dk)!;
      for (const it of cn.items) {
        const key = `${it.description}|||${it.unit}`;
        const tax = Math.round(it.amount * (cn.gstRate || 5)) / 100;
        if (!pm.has(key)) pm.set(key, { qty: 0, unit: it.unit, rate: it.rate, amount: 0, tax: 0 });
        const p = pm.get(key)!;
        p.qty -= it.qty; p.amount -= it.amount; p.tax -= tax;
      }
    }
  }

  return [...dayMap.entries()]
    .map(([dateStr, pm]) => {
      const products: ProductRow[] = [...pm.entries()].map(([key, p]) => {
        const [description] = key.split('|||');
        return { description, totalQty: p.qty, unit: p.unit, rate: p.rate, gross: p.amount, disc: 0, taxable: p.amount, tax: p.tax, net: p.amount + p.tax };
      }).sort((a, b) => a.description.localeCompare(b.description));
      const totals = products.reduce((a, p) => ({
        gross: a.gross + p.gross, disc: 0, taxable: a.taxable + p.taxable, tax: a.tax + p.tax, net: a.net + p.net,
      }), { gross: 0, disc: 0, taxable: 0, tax: 0, net: 0 });
      return { dateStr, products, totals };
    })
    .sort((a, b) => parseKey(a.dateStr).getTime() - parseKey(b.dateStr).getTime());
}

function buildPartyWise(sales: SaleRecord[]): PartyGroup[] {
  const pm = new Map<string, InvoiceRow[]>();
  for (const sale of [...sales].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))) {
    const name = sale.customerName || 'Cash Customer';
    if (!pm.has(name)) pm.set(name, []);
    const term = sale.netAmount - sale.grossAmount - sale.gstAmount;
    pm.get(name)!.push({
      docNo: sale.invoiceNo, partyName: name,
      gross: sale.grossAmount, disc: 0, taxable: sale.grossAmount,
      tax: sale.gstAmount, term, net: sale.netAmount,
      items: sale.items.map(it => {
        const tax = Math.round(it.amount * (sale.gstRate || 5)) / 100;
        return { description: it.description, qty: it.qty, unit: it.unit, rate: it.rate, gross: it.amount, tax, net: it.amount + tax };
      }),
    });
  }
  return [...pm.entries()]
    .map(([partyName, invoices]) => ({
      partyName, invoices,
      totals: invoices.reduce<DayTotals>((a, inv) => ({
        gross: a.gross + inv.gross, disc: a.disc + inv.disc, taxable: a.taxable + inv.taxable,
        tax: a.tax + inv.tax, term: a.term + inv.term, net: a.net + inv.net,
      }), { gross: 0, disc: 0, taxable: 0, tax: 0, term: 0, net: 0 }),
    }))
    .sort((a, b) => a.partyName.localeCompare(b.partyName));
}

// ── Shared print header ───────────────────────────────────────────────────────
function PrintHeader({ heading, printedAt }: { heading: string; printedAt: string }) {
  return (
    <div className="print-header" style={{ fontFamily: 'Arial, sans-serif', textAlign: 'center', marginBottom: '8px' }}>
      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{BIZ_NAME}</div>
      <div style={{ fontSize: '10px', marginTop: '2px' }}>{BIZ_SUB}</div>
      <div style={{ fontWeight: 'bold', fontSize: '11px', marginTop: '4px', textTransform: 'uppercase', textAlign: 'left' }}>{heading}</div>
      <div style={{ fontSize: '9px', textAlign: 'right', marginTop: '-16px' }}>Printed On {printedAt}</div>
      <hr style={{ borderTop: '1px solid #000', marginTop: '4px' }} />
    </div>
  );
}

// ── Date Wise Party Wise report ───────────────────────────────────────────────
function DatePartyWiseReport({ data, heading, printedAt, itemDetails }: {
  data: DayGroup[]; heading: string; printedAt: string; itemDetails: boolean;
}) {
  const grand = data.reduce<DayTotals>((a, dg) => ({
    gross: a.gross + dg.totals.gross, disc: a.disc + dg.totals.disc,
    taxable: a.taxable + dg.totals.taxable, tax: a.tax + dg.totals.tax,
    term: a.term + dg.totals.term, net: a.net + dg.totals.net,
  }), { gross: 0, disc: 0, taxable: 0, tax: 0, term: 0, net: 0 });

  const thCls = 'text-right py-0.5 px-1.5 text-[10px] font-bold uppercase tracking-wide border-b border-black';
  const tdCls = 'text-right py-0.5 px-1.5 text-[10px] border-b border-gray-200';
  const tdL   = 'text-left py-0.5 px-1.5 text-[10px] border-b border-gray-200';

  return (
    <div id="sr-print" style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', color: '#000', padding: '6mm', width: '100%' }}>
      <PrintHeader heading={heading} printedAt={printedAt} />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
            <th className={thCls} style={{ textAlign: 'left', width: '28%' }}>DOC#</th>
            <th className={thCls} style={{ width: '13%' }}>GROSS</th>
            <th className={thCls} style={{ width: '8%' }}>DISC.</th>
            <th className={thCls} style={{ width: '13%' }}>TAXABLE</th>
            <th className={thCls} style={{ width: '10%' }}>TAX</th>
            <th className={thCls} style={{ width: '8%' }}>TERM</th>
            <th className={thCls} style={{ width: '13%' }}>NET</th>
          </tr>
        </thead>
        <tbody>
          {data.map(dg => (
            <>
              {/* Date bar */}
              <tr key={`date-${dg.dateStr}`} style={{ pageBreakInside: 'avoid' }}>
                <td colSpan={7} style={{ fontWeight: 'bold', fontSize: '10px', paddingTop: '5px', paddingBottom: '1px', paddingLeft: '3px', borderBottom: '1px solid #ccc' }}>
                  {dg.dateStr}
                </td>
              </tr>

              {dg.invoices.map(inv => (
                <>
                  {/* Invoice header row */}
                  <tr key={inv.docNo} style={{ pageBreakInside: 'avoid' }}>
                    <td className={tdL} style={{ fontWeight: 'bold', paddingLeft: '4px' }}>{inv.docNo}{inv.partyName && inv.partyName !== 'Cash Customer' ? <span style={{ fontWeight: 'normal', marginLeft: '8px' }}>{inv.partyName}</span> : null}</td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.gross)}</td>
                    <td className={tdCls}>{fmtCell(inv.disc)}</td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.taxable)}</td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.tax)}</td>
                    <td className={tdCls}>{fmtCell(inv.term)}</td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.net)}</td>
                  </tr>

                  {/* Line items */}
                  {itemDetails && inv.items.map((item, idx) => (
                    <tr key={`${inv.docNo}-item-${idx}`} style={{ pageBreakInside: 'avoid' }}>
                      <td className={tdL} style={{ paddingLeft: '18px', color: '#333' }}>
                        {item.description}
                      </td>
                      <td className={tdCls} style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {fmtFixed(item.qty)}&nbsp;{item.unit}
                      </td>
                      <td className={tdCls}>{fmtFixed(item.rate)}</td>
                      <td className={tdCls}>{fmtFixed(item.gross)}</td>
                      <td className={tdCls}>{fmtFixed(item.tax)}</td>
                      <td className={tdCls}>-</td>
                      <td className={tdCls}>{fmtFixed(item.net)}</td>
                    </tr>
                  ))}
                </>
              ))}

              {/* Day total */}
              <tr key={`day-total-${dg.dateStr}`} style={{ pageBreakInside: 'avoid', borderTop: '1px solid #999' }}>
                <td className={tdL} style={{ fontWeight: 'bold', paddingLeft: '4px' }}>*DAY TOTAL*</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.gross)}</td>
                <td className={tdCls} style={{ borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.disc)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.taxable)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.tax)}</td>
                <td className={tdCls} style={{ borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.term)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.net)}</td>
              </tr>
              <tr key={`spacer-${dg.dateStr}`}><td colSpan={7} style={{ height: '6px' }} /></tr>
            </>
          ))}

          {/* Grand total */}
          <tr style={{ borderTop: '2px solid #000', pageBreakInside: 'avoid' }}>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 3px', textAlign: 'left' }}>GRAND TOTAL</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.gross)}</td>
            <td style={{ padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.disc)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.taxable)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.tax)}</td>
            <td style={{ padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.term)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Date Wise Product Wise report ─────────────────────────────────────────────
function DateProductWiseReport({ data, heading, printedAt }: {
  data: ProductDayGroup[]; heading: string; printedAt: string;
}) {
  const grand = data.reduce((a, dg) => ({
    gross: a.gross + dg.totals.gross, disc: 0,
    taxable: a.taxable + dg.totals.taxable, tax: a.tax + dg.totals.tax, net: a.net + dg.totals.net,
  }), { gross: 0, disc: 0, taxable: 0, tax: 0, net: 0 });

  const thCls = 'text-right py-0.5 px-1.5 text-[10px] font-bold uppercase tracking-wide border-b border-black';
  const tdCls = 'text-right py-0.5 px-1.5 text-[10px] border-b border-gray-200';
  const tdL   = 'text-left py-0.5 px-1.5 text-[10px] border-b border-gray-200';

  return (
    <div id="sr-print" style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', color: '#000', padding: '6mm', width: '100%' }}>
      <PrintHeader heading={heading} printedAt={printedAt} />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
            <th className={thCls} style={{ textAlign: 'left', width: '30%' }}>PARTICULARS</th>
            <th className={thCls} style={{ width: '12%' }}>QTY</th>
            <th className={thCls} style={{ width: '10%' }}>RATE</th>
            <th className={thCls} style={{ width: '11%' }}>GROSS</th>
            <th className={thCls} style={{ width: '8%' }}>DISC.</th>
            <th className={thCls} style={{ width: '11%' }}>TAXABLE</th>
            <th className={thCls} style={{ width: '10%' }}>TAX</th>
            <th className={thCls} style={{ width: '11%' }}>NET</th>
          </tr>
        </thead>
        <tbody>
          {data.map(dg => (
            <>
              <tr key={`date-${dg.dateStr}`}>
                <td colSpan={8} style={{ fontWeight: 'bold', fontSize: '10px', paddingTop: '5px', paddingBottom: '1px', paddingLeft: '3px', borderBottom: '1px solid #ccc' }}>
                  {dg.dateStr}
                </td>
              </tr>
              {dg.products.map((p, idx) => (
                <tr key={`${dg.dateStr}-prod-${idx}`} style={{ pageBreakInside: 'avoid' }}>
                  <td className={tdL} style={{ paddingLeft: '12px' }}>{p.description}</td>
                  <td className={tdCls} style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{fmtFixed(p.totalQty)}{p.unit}</td>
                  <td className={tdCls}>{fmtFixed(p.rate)}</td>
                  <td className={tdCls}>{fmtFixed(p.gross)}</td>
                  <td className={tdCls}>{fmtFixed(p.disc)}</td>
                  <td className={tdCls}>{fmtFixed(p.taxable)}</td>
                  <td className={tdCls}>{fmtFixed(p.tax)}</td>
                  <td className={tdCls}>{fmtFixed(p.net)}</td>
                </tr>
              ))}
              <tr key={`day-total-${dg.dateStr}`} style={{ borderTop: '1px solid #999' }}>
                <td className={tdL} style={{ fontWeight: 'bold', paddingLeft: '4px' }}>*DAY TOTAL*</td>
                <td colSpan={2} />
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.gross)}</td>
                <td className={tdCls} style={{ borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.disc)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.taxable)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.tax)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(dg.totals.net)}</td>
              </tr>
              <tr key={`spacer-${dg.dateStr}`}><td colSpan={8} style={{ height: '6px' }} /></tr>
            </>
          ))}
          <tr style={{ borderTop: '2px solid #000' }}>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 3px', textAlign: 'left' }}>GRAND TOTAL</td>
            <td colSpan={2} />
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.gross)}</td>
            <td style={{ padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.disc)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.taxable)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.tax)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Party Wise report ─────────────────────────────────────────────────────────
function PartyWiseReport({ data, heading, printedAt, itemDetails }: {
  data: PartyGroup[]; heading: string; printedAt: string; itemDetails: boolean;
}) {
  const grand = data.reduce<DayTotals>((a, pg) => ({
    gross: a.gross + pg.totals.gross, disc: a.disc + pg.totals.disc, taxable: a.taxable + pg.totals.taxable,
    tax: a.tax + pg.totals.tax, term: a.term + pg.totals.term, net: a.net + pg.totals.net,
  }), { gross: 0, disc: 0, taxable: 0, tax: 0, term: 0, net: 0 });

  const thCls = 'text-right py-0.5 px-1.5 text-[10px] font-bold uppercase tracking-wide border-b border-black';
  const tdCls = 'text-right py-0.5 px-1.5 text-[10px] border-b border-gray-200';
  const tdL   = 'text-left py-0.5 px-1.5 text-[10px] border-b border-gray-200';

  return (
    <div id="sr-print" style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', color: '#000', padding: '6mm', width: '100%' }}>
      <PrintHeader heading={heading} printedAt={printedAt} />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
            <th className={thCls} style={{ textAlign: 'left', width: '28%' }}>DOC#</th>
            <th className={thCls} style={{ width: '13%' }}>GROSS</th>
            <th className={thCls} style={{ width: '8%' }}>DISC.</th>
            <th className={thCls} style={{ width: '13%' }}>TAXABLE</th>
            <th className={thCls} style={{ width: '10%' }}>TAX</th>
            <th className={thCls} style={{ width: '8%' }}>TERM</th>
            <th className={thCls} style={{ width: '13%' }}>NET</th>
          </tr>
        </thead>
        <tbody>
          {data.map(pg => (
            <>
              <tr key={`party-${pg.partyName}`}>
                <td colSpan={7} style={{ fontWeight: 'bold', fontSize: '10px', paddingTop: '5px', paddingBottom: '1px', paddingLeft: '3px', borderBottom: '1px solid #ccc' }}>
                  {pg.partyName}
                </td>
              </tr>
              {pg.invoices.map(inv => (
                <>
                  <tr key={inv.docNo}>
                    <td className={tdL} style={{ fontWeight: 'bold', paddingLeft: '4px' }}>{inv.docNo}
                      <span style={{ fontSize: '9px', fontWeight: 'normal', marginLeft: '8px', color: '#555' }}>{fmtDateDisp(new Date())}</span>
                    </td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.gross)}</td>
                    <td className={tdCls}>{fmtCell(inv.disc)}</td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.taxable)}</td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.tax)}</td>
                    <td className={tdCls}>{fmtCell(inv.term)}</td>
                    <td className={tdCls} style={{ fontWeight: 'bold' }}>{fmtFixed(inv.net)}</td>
                  </tr>
                  {itemDetails && inv.items.map((item, idx) => (
                    <tr key={`${inv.docNo}-i-${idx}`}>
                      <td className={tdL} style={{ paddingLeft: '18px', color: '#333' }}>{item.description}</td>
                      <td className={tdCls} style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{fmtFixed(item.qty)}&nbsp;{item.unit}</td>
                      <td className={tdCls}>{fmtFixed(item.rate)}</td>
                      <td className={tdCls}>{fmtFixed(item.gross)}</td>
                      <td className={tdCls}>{fmtFixed(item.tax)}</td>
                      <td className={tdCls}>-</td>
                      <td className={tdCls}>{fmtFixed(item.net)}</td>
                    </tr>
                  ))}
                </>
              ))}
              <tr key={`party-total-${pg.partyName}`} style={{ borderTop: '1px solid #999' }}>
                <td className={tdL} style={{ fontWeight: 'bold', paddingLeft: '4px' }}>*{pg.partyName.toUpperCase().slice(0, 18)} TOTAL*</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(pg.totals.gross)}</td>
                <td className={tdCls} style={{ borderBottom: '2px solid #000' }}>{fmtFixed(pg.totals.disc)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(pg.totals.taxable)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(pg.totals.tax)}</td>
                <td className={tdCls} style={{ borderBottom: '2px solid #000' }}>{fmtFixed(pg.totals.term)}</td>
                <td className={tdCls} style={{ fontWeight: 'bold', borderBottom: '2px solid #000' }}>{fmtFixed(pg.totals.net)}</td>
              </tr>
              <tr key={`spacer-${pg.partyName}`}><td colSpan={7} style={{ height: '6px' }} /></tr>
            </>
          ))}
          <tr style={{ borderTop: '2px solid #000' }}>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 3px', textAlign: 'left' }}>GRAND TOTAL</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.gross)}</td>
            <td style={{ padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.disc)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.taxable)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.tax)}</td>
            <td style={{ padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.term)}</td>
            <td style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 6px', textAlign: 'right', borderBottom: '3px double #000' }}>{fmtFixed(grand.net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SalesReport() {
  const [leftKey,  setLeftKey]  = useState<LeftKey>('Date');
  const [rightKey, setRightKey] = useState<RightKey>('Party');
  const [from,     setFrom]     = useState(thisMonthStart());
  const [to,       setTo]       = useState(todayStr());
  const [allParty,       setAllParty]       = useState(true);
  const [includeCashBank, setIncludeCashBank] = useState(true);
  const [includeReturns,  setIncludeReturns]  = useState(true);
  const [itemDetails,     setItemDetails]     = useState(true);
  const [format, setFormat] = useState<'D' | 'S'>('D');
  const [reportHeading, setReportHeading] = useState('Sale Bill Date Wise Party Wise');
  const [showReport, setShowReport] = useState(false);
  const [printedAt,  setPrintedAt]  = useState('');

  // Inject print styles
  useEffect(() => {
    const id = 'sr-media-print';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = `
        @media print {
          * { visibility: hidden !important; }
          #sr-print, #sr-print * { visibility: visible !important; }
          #sr-print { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; background: white !important; }
          @page { margin: 8mm 10mm; size: A4 portrait; }
        }
      `;
      document.head.appendChild(s);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  function selectLeft(k: LeftKey) {
    setLeftKey(k);
    setReportHeading(autoHeading(k, rightKey));
    setShowReport(false);
  }
  function selectRight(k: RightKey) {
    setRightKey(k);
    setReportHeading(autoHeading(leftKey, k));
    setShowReport(false);
  }

  const [allSales, setAllSales] = useState<SaleRecord[] | null>(null);
  const [allCreditNotes, setAllCreditNotes] = useState<CreditNote[] | null>(null);

  const loadData = useCallback(() => {
    salesCRUD.getAll().then(setAllSales);
    creditNoteCRUD.getAll().then(setAllCreditNotes);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter client-side by date range
  const sales = allSales === null ? null : allSales.filter(s => {
    const d = new Date(s.timestamp);
    return d >= new Date(from) && d <= new Date(to + 'T23:59:59');
  });
  const creditNotes = allCreditNotes === null ? null : allCreditNotes.filter(cn => {
    const d = new Date(cn.timestamp);
    return d >= new Date(from) && d <= new Date(to + 'T23:59:59');
  });

  const isReady = !!(sales && creditNotes);

  // Build report data
  const cns = (includeReturns ? creditNotes : []) ?? [];
  const datePartyData    = showReport && isReady && !(leftKey === 'Date' && rightKey === 'Product') && leftKey !== 'Party'
    ? buildDatePartyWise(sales!, cns, includeReturns) : [];
  const dateProductData  = showReport && isReady && leftKey === 'Date' && rightKey === 'Product'
    ? buildDateProductWise(sales!, cns, includeReturns) : [];
  const partyData        = showReport && isReady && leftKey === 'Party'
    ? buildPartyWise(sales!) : [];

  function handleReport() {
    setPrintedAt(printedNow());
    setShowReport(true);
  }

  function handlePrint() { window.print(); }

  const isProductWise = leftKey === 'Date' && rightKey === 'Product';
  const isPartyWise   = leftKey === 'Party';

  // Summary stats
  const totalSales  = sales?.length ?? 0;
  const totalNet    = (sales ?? []).reduce((s, r) => s + r.netAmount, 0);
  const totalGross  = (sales ?? []).reduce((s, r) => s + r.grossAmount, 0);
  const totalTax    = (sales ?? []).reduce((s, r) => s + r.gstAmount, 0);

  // Button styles
  const toggleBase = 'w-full text-left px-3 py-1.5 text-xs font-medium rounded transition-colors border';
  const toggleOn   = `${toggleBase} bg-blue-600 border-blue-500 text-white`;
  const toggleOff  = `${toggleBase} bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white`;

  return (
    <div className="space-y-4">

      {/* ── Configuration panel ─────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-700 bg-slate-750">
          <h3 className="text-white font-semibold text-sm">Report Options</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {rightKey === 'Product' && leftKey === 'Date' ? 'Date Wise Product Wise' :
             leftKey === 'Party' ? 'Party Wise' :
             `${leftKey} Wise ${rightKey} Wise`}
          </p>
        </div>

        <div className="grid grid-cols-[140px_1fr_140px] divide-x divide-slate-700">

          {/* Left toggles */}
          <div className="p-3 space-y-1">
            {LEFT_KEYS.map(k => (
              <button key={k} onClick={() => selectLeft(k)} className={leftKey === k ? toggleOn : toggleOff}>
                {leftKey === k && <span className="mr-1">▶</span>}{k}
              </button>
            ))}
          </div>

          {/* Center config */}
          <div className="p-4 space-y-3">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[10px] mb-0.5 uppercase tracking-wide">From</label>
                <input type="date" value={from} onChange={e => { setFrom(e.target.value); setShowReport(false); }}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-slate-400 text-[10px] mb-0.5 uppercase tracking-wide">Upto</label>
                <input type="date" value={to} onChange={e => { setTo(e.target.value); setShowReport(false); }}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'All Party?',          val: allParty,        set: setAllParty        },
                { label: 'Include Cash/Bank?',  val: includeCashBank, set: setIncludeCashBank  },
                { label: 'Include Returns?',    val: includeReturns,  set: (v: boolean) => { setIncludeReturns(v); setShowReport(false); } },
                { label: 'Item Details?',       val: itemDetails,     set: setItemDetails      },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                    className="accent-orange-500 w-3.5 h-3.5" />
                  <span className="text-slate-300 text-xs group-hover:text-white transition-colors">{label}</span>
                </label>
              ))}
            </div>

            {/* Format selector */}
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-xs">Detail / Summary?</span>
              <div className="flex gap-1">
                {(['D', 'S'] as const).map(f => (
                  <button key={f} onClick={() => { setFormat(f); setShowReport(false); }}
                    className={`w-8 h-7 text-xs font-bold rounded border transition-colors ${
                      format === f ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                    }`}>{f}</button>
                ))}
              </div>
            </div>

            {/* Summary stats bar */}
            {isReady && (
              <div className="flex gap-4 bg-slate-700/40 rounded-lg px-3 py-2 text-xs">
                <span className="text-slate-400">{totalSales} invoices</span>
                <span className="text-slate-300">Gross: <span className="text-orange-400 font-mono">Nu.{totalGross.toFixed(0)}</span></span>
                <span className="text-slate-300">Tax: <span className="text-yellow-400 font-mono">Nu.{totalTax.toFixed(0)}</span></span>
                <span className="text-slate-300">Net: <span className="text-green-400 font-mono font-semibold">Nu.{totalNet.toFixed(0)}</span></span>
              </div>
            )}

            {/* Report heading */}
            <div>
              <label className="block text-slate-400 text-[10px] mb-0.5 uppercase tracking-wide">Report Heading</label>
              <input value={reportHeading} onChange={e => setReportHeading(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button onClick={handleReport} disabled={!isReady}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
                <FileText className="w-4 h-4" />
                Report
              </button>
              {showReport && (
                <button onClick={handlePrint}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-5 py-2 rounded-lg text-sm font-semibold transition-colors border border-slate-600">
                  <Printer className="w-4 h-4" />
                  Print / PDF
                </button>
              )}
              {showReport && (
                <button onClick={() => setShowReport(false)}
                  className="flex items-center gap-2 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors">
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Right toggles */}
          <div className="p-3 space-y-1">
            {RIGHT_KEYS.map(k => (
              <button key={k} onClick={() => selectRight(k)} className={rightKey === k ? toggleOn : toggleOff}>
                {rightKey === k && <span className="mr-1">◀</span>}{k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Report preview ───────────────────────────────────────────────────── */}
      {showReport && isReady && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-lg overflow-hidden">
          {/* Screen preview toolbar */}
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between no-print">
            <span className="text-slate-600 text-xs font-medium">Report Preview — {reportHeading}</span>
            <div className="flex gap-2">
              <span className="text-slate-400 text-xs">{from} to {to}</span>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded font-medium transition-colors">
                <Printer className="w-3 h-3" /> Print / Save PDF
              </button>
            </div>
          </div>

          {/* Report content */}
          {isProductWise ? (
            <DateProductWiseReport
              data={dateProductData}
              heading={reportHeading}
              printedAt={printedAt}
            />
          ) : isPartyWise ? (
            <PartyWiseReport
              data={partyData}
              heading={reportHeading}
              printedAt={printedAt}
              itemDetails={itemDetails}
            />
          ) : (
            <DatePartyWiseReport
              data={datePartyData}
              heading={reportHeading}
              printedAt={printedAt}
              itemDetails={itemDetails}
            />
          )}

          {(isProductWise ? dateProductData : isPartyWise ? partyData : datePartyData).length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">
              No sales records found for the selected date range.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
