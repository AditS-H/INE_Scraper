import { createHash } from 'node:crypto';
import { ScrapeError } from '../lib/errors.js';
import { STORE_PROFILE as SP } from './storeProfile.js';

const sha256 = (input) => createHash('sha256').update(input).digest();

/** Decodes the encrypted `e` field returned by /api/products/:id/price. */
export function decryptQuote(encrypted, sessionToken) {
  if (typeof encrypted !== 'string' || !encrypted) throw new ScrapeError('PARSE_FAILED', 'price response had no encrypted payload');
  if (typeof sessionToken !== 'string' || !sessionToken) throw new ScrapeError('SESSION_EXPIRED', 'price response arrived without a session token', { retryable: true });

  const cipher = Buffer.from(encrypted, 'base64');
  const key = sha256(`${SP.crypto.responseKeyPrefix}${sessionToken}`);
  const plain = Buffer.allocUnsafe(cipher.length);
  for (let index = 0; index < cipher.length; index += 1) plain[index] = cipher[index] ^ key[index % key.length];

  try {
    const quote = JSON.parse(plain.toString('utf8'));
    if (!quote || typeof quote !== 'object') throw new Error('not an object');
    return quote;
  } catch (error) {
    throw new ScrapeError('PARSE_FAILED', 'price response could not be decrypted', { cause: error });
  }
}
