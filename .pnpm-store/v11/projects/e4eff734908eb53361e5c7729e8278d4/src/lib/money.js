const SYMBOL_TO_CODE = { '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };

const round2 = (value) => Math.round(value * 100) / 100;

export function parseMoney(input, fallbackCurrency = 'INR') {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0)
    return { amount: round2(input), currency: fallbackCurrency, confidence: 'high' };

  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('empty price input');
  const symbol = Object.keys(SYMBOL_TO_CODE).find((candidate) => raw.includes(candidate));
  const currency = raw.match(/\b(INR|USD|EUR|GBP|JPY)\b/i)?.[1]?.toUpperCase()
    ?? (symbol ? SYMBOL_TO_CODE[symbol] : fallbackCurrency);
  const digits = raw.replace(/[^\d.,\s']/g, '').replace(/[\s']/g, '');
  if (!/\d/.test(digits)) throw new Error(`no digits in price: ${raw}`);

  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  const separator = Math.max(lastDot, lastComma);
  let normalised = digits;
  if (separator !== -1) {
    const decimalDigits = digits.length - separator - 1;
    normalised = decimalDigits >= 1 && decimalDigits <= 2
      ? `${digits.slice(0, separator).replace(/[.,]/g, '')}.${digits.slice(separator + 1)}`
      : digits.replace(/[.,]/g, '');
  }
  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`invalid price: ${raw}`);
  return { amount: round2(amount), currency, confidence: 'high' };
}

export function normaliseStock(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`invalid stock quantity: ${quantity}`);
  return quantity > 0
    ? { in_stock: true, stock_status: quantity === 1 ? 'Only 1 Left' : 'In Stock', stock_qty: quantity }
    : { in_stock: false, stock_status: 'Out Of Stock', stock_qty: 0 };
}
