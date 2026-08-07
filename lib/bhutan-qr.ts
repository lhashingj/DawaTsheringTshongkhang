/**
 * Bhutan QR (BQPS / EMVCo merchant-presented QR) helpers.
 *
 * A Bhutan bank QR is an EMVCo payload: a flat list of TLV fields
 * (2-digit tag id, 2-digit decimal length, then that many value chars).
 * A *static* QR (tag 01 = "11") has no amount — the payer types it.
 * A *dynamic* QR (tag 01 = "12") carries the amount in tag 54, so the
 * payer just scans and confirms. This module turns a bank's static QR
 * into a per-invoice dynamic QR with the exact amount and an invoice
 * reference, recomputing the trailing CRC so banking apps accept it.
 */

export interface EmvTag {
  id: string;
  value: string;
}

/** Parse an EMVCo TLV payload into an ordered list of tags. */
export function parseTags(payload: string): EmvTag[] {
  const tags: EmvTag[] = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (isNaN(len)) break;
    const value = payload.slice(i + 4, i + 4 + len);
    tags.push({ id, value });
    i += 4 + len;
  }
  return tags;
}

/** Serialize a single tag back into `id + 2-digit length + value`. */
export function serializeTag(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

/**
 * CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no input/output reflection,
 * no final XOR. Returned as a 4-character uppercase hex string (EMVCo tag 63).
 */
export function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Replace a tag's value in-place, or append it if not present. */
function setTag(tags: EmvTag[], id: string, value: string): void {
  const existing = tags.find(t => t.id === id);
  if (existing) existing.value = value;
  else tags.push({ id, value });
}

export interface BuildDynamicQROptions {
  /** The bank's static QR payload (as printed / stored). */
  staticPayload: string;
  /** Amount to charge, in Ngultrum. */
  amount: number;
  /** Optional invoice reference stored in tag 62 subfield 05 (max 25 chars). */
  invoiceRef?: string;
}

/**
 * Turn a bank's static QR into a dynamic, per-invoice QR:
 *  - drops the old CRC (tag 63)
 *  - tag 01 → "12" (dynamic point of initiation)
 *  - tag 54 → amount fixed to 2 decimals
 *  - tag 62 (Additional Data Field Template) subfield 05 → invoice ref,
 *    preserving any other subfields the bank already included
 *  - re-serializes all tags ordered by ascending numeric tag id
 *  - appends "6304" + a freshly computed CRC over the whole string
 */
export function buildDynamicBhutanQR({ staticPayload, amount, invoiceRef }: BuildDynamicQROptions): string {
  const tags = parseTags(staticPayload).filter(t => t.id !== '63');

  setTag(tags, '01', '12');
  setTag(tags, '54', amount.toFixed(2));

  if (invoiceRef) {
    const ref = invoiceRef.slice(0, 25);
    const existing62 = tags.find(t => t.id === '62');
    const subTags = existing62 ? parseTags(existing62.value) : [];
    setTag(subTags, '05', ref);
    const rebuilt62 = subTags
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(t => serializeTag(t.id, t.value))
      .join('');
    setTag(tags, '62', rebuilt62);
  }

  const body = tags
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map(t => serializeTag(t.id, t.value))
    .join('');

  const toCrc = body + '6304';
  return toCrc + crc16ccitt(toCrc);
}
