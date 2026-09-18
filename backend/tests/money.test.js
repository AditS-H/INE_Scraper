import { describe, expect, it } from 'vitest';
import { normaliseStock, parseMoney } from '../src/lib/money.js';

describe('money and stock validation', () => {
  it('handles Indian and western grouping', () => {
    expect(parseMoney('₹1,23,456.78')).toMatchObject({ amount: 123456.78, currency: 'INR' });
    expect(parseMoney('$1,234.56')).toMatchObject({ amount: 1234.56, currency: 'USD' });
  });
  it('rejects placeholders and zero', () => {
    expect(() => parseMoney('•••')).toThrow();
    expect(() => parseMoney('Rs. 0')).toThrow();
  });
  it('represents out of stock without discarding the price', () => {
    expect(normaliseStock(0)).toEqual({ in_stock: false, stock_status: 'Out Of Stock', stock_qty: 0 });
  });
});
