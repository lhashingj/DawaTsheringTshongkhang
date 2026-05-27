const ones = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function chunk(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) {
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit ? '-' + ones[unit] : '');
  }
  const remainder = n % 100;
  return ones[Math.floor(n / 100)] + ' hundred' + (remainder ? ' ' + chunk(remainder) : '');
}

export function numberToWords(amount: number): string {
  if (!isFinite(amount) || amount < 0) return 'Ngultrum zero only';

  const whole = Math.floor(amount);
  const decimal = Math.round((amount - whole) * 100);
  const parts: string[] = [];

  if (whole === 0) {
    parts.push('zero');
  } else {
    const millions = Math.floor(whole / 1_000_000);
    const thousands = Math.floor((whole % 1_000_000) / 1_000);
    const hundreds = whole % 1_000;

    if (millions > 0) parts.push(chunk(millions) + ' million');
    if (thousands > 0) parts.push(chunk(thousands) + ' thousand');
    if (hundreds > 0) parts.push(chunk(hundreds));
  }

  let result = 'Ngultrum ' + parts.join(' ');
  if (decimal > 0) result += ' and ' + chunk(decimal) + ' chhertum';
  return result + ' only';
}
