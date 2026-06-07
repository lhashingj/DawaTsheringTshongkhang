import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { PartyRecord, PartyType } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function toRecord(row: Record<string, unknown>): PartyRecord & { id: number } {
  return {
    id: Number(row.id),
    partyType: row.party_type as PartyType,
    name: row.name as string,
    phone: (row.phone as string) ?? undefined,
    address: (row.address as string) ?? undefined,
    email: (row.email as string) ?? undefined,
    tpn: (row.tpn as string) ?? undefined,
    licenseNo: (row.license_no as string) ?? undefined,
    gstNo: (row.gst_no as string) ?? undefined,
    procurementOfficer: (row.procurement_officer as string) ?? undefined,
    openingBalance: row.opening_balance != null ? Number(row.opening_balance) : undefined,
    outstandingBalance: Number(row.outstanding_balance),
    notes: (row.notes as string) ?? undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_parties').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const body = await request.json() as Partial<PartyRecord> & { outstandingBalanceDelta?: number };

  // Atomic balance delta — read current then write new value
  if (body.outstandingBalanceDelta !== undefined) {
    const { data: current, error: fetchErr } = await supabase
      .from('accounting_parties').select('outstanding_balance').eq('id', id).single();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    const newBalance = Number(current.outstanding_balance) + body.outstandingBalanceDelta;
    const { data, error } = await supabase
      .from('accounting_parties')
      .update({ outstanding_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(toRecord(data));
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.partyType != null) update.party_type = body.partyType;
  if (body.name != null) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone ?? null;
  if (body.address !== undefined) update.address = body.address ?? null;
  if (body.email !== undefined) update.email = body.email ?? null;
  if (body.tpn !== undefined) update.tpn = body.tpn ?? null;
  if (body.licenseNo !== undefined) update.license_no = body.licenseNo ?? null;
  if (body.gstNo !== undefined) update.gst_no = body.gstNo ?? null;
  if (body.procurementOfficer !== undefined) update.procurement_officer = body.procurementOfficer ?? null;
  if (body.openingBalance != null) update.opening_balance = body.openingBalance;
  if (body.outstandingBalance != null) update.outstanding_balance = body.outstandingBalance;
  if (body.notes !== undefined) update.notes = body.notes ?? null;

  const { data, error } = await supabase.from('accounting_parties').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_parties').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
