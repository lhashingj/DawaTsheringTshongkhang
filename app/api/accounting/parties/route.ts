import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { PartyRecord, PartyType } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_parties').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<PartyRecord, 'id'> = await request.json();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('accounting_parties')
    .insert({
      party_type: body.partyType,
      name: body.name,
      phone: body.phone ?? null,
      address: body.address ?? null,
      email: body.email ?? null,
      tpn: body.tpn ?? null,
      license_no: body.licenseNo ?? null,
      gst_no: body.gstNo ?? null,
      procurement_officer: body.procurementOfficer ?? null,
      opening_balance: body.openingBalance ?? 0,
      outstanding_balance: body.outstandingBalance,
      notes: body.notes ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
