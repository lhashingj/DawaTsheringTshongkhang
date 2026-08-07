import { createServerClient } from '@/lib/supabase-server';
import { buildDynamicBhutanQR } from '@/lib/bhutan-qr';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const STATIC_QR: Record<string, string | undefined> = {
  bob: process.env.BOB_STATIC_QR,
  bnb: process.env.BNB_STATIC_QR,
};

// GET /api/invoices/[id]/qr?bank=bob|bnb
// Renders a dynamic Bhutan QR (PNG) for the invoice's total amount.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const bank = (searchParams.get('bank') || 'bob').toLowerCase();
  const staticPayload = STATIC_QR[bank];
  if (!staticPayload) {
    return new Response(`Unknown or unconfigured bank: ${bank}`, { status: 400 });
  }

  // Authoritative source: the same accounting_sales table the ledger API uses.
  const supabase = createServerClient();
  const { data } = await supabase
    .from('accounting_sales')
    .select('net_amount')
    .eq('id', id)
    .single();

  // The live ledger runs on IndexedDB and only reaches Supabase after a Cloud
  // backup, so fall back to the amount the invoice view already holds locally.
  const amountParam = searchParams.get('amount');
  const amount = data ? Number(data.net_amount) : amountParam != null ? Number(amountParam) : NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response('Invoice not found or amount unavailable', { status: 404 });
  }

  const payload = buildDynamicBhutanQR({
    staticPayload,
    amount,
    invoiceRef: `INV-${id}`,
  });

  const png = await QRCode.toBuffer(payload, {
    width: 320,
    errorCorrectionLevel: 'M',
    margin: 1,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
