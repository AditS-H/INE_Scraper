import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptQuote } from '../src/scraper/decryptQuote.js';

function encrypt(quote, token) {
  const plain = Buffer.from(JSON.stringify(quote));
  const key = createHash('sha256').update(`ine-mock-store-shared-k3y|enc|${token}`).digest();
  const cipher = Buffer.alloc(plain.length);
  for (let i = 0; i < plain.length; i += 1) cipher[i] = plain[i] ^ key[i % key.length];
  return cipher.toString('base64');
}

describe('decryptQuote', () => {
  it('recovers a structured quote using the session token', () => {
    const quote = { p: 15070, m: 20644, s: 0, c: 'INR', f: 'lakh' };
    expect(decryptQuote(encrypt(quote, 'session-token'), 'session-token')).toEqual(quote);
  });
  it('fails closed when the token is wrong', () => {
    expect(() => decryptQuote(encrypt({ p: 1 }, 'right'), 'wrong')).toThrow('could not be decrypted');
  });
});
