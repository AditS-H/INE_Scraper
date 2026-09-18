export class ScrapeError extends Error {
  constructor(code, message, { status = null, retryable = false, cause = null } = {}) {
    super(message, { cause });
    this.name = 'ScrapeError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function classify(status, err) {
  const message = String(err?.message ?? err ?? '');
  if (/timeout|ETIMEDOUT|ERR_TIMED_OUT/i.test(message))
    return new ScrapeError('TIMEOUT', 'upstream request timed out', { retryable: true, cause: err });
  if (/ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(message))
    return new ScrapeError('NETWORK', message, { retryable: true, cause: err });
  if (status === 429) return new ScrapeError('RATE_LIMITED', 'upstream rate limited the request', { status, retryable: true });
  if (status === 408 || status === 425) return new ScrapeError('TIMEOUT', `upstream returned ${status}`, { status, retryable: true });
  if (status >= 500) return new ScrapeError('HTTP_5XX', `upstream returned ${status}`, { status, retryable: true });
  if (status === 401 || status === 403) return new ScrapeError('SESSION_EXPIRED', 'session proof or bearer token was rejected', { status, retryable: true });
  if (status === 409 || status === 410 || status === 412) return new ScrapeError('TOKEN_INVALID', 'challenge token was invalid or expired', { status, retryable: true });
  if (status === 404) return new ScrapeError('NOT_FOUND', 'store product was not found', { status, retryable: false });
  if (status >= 400) return new ScrapeError('HTTP_4XX', `upstream returned ${status}`, { status, retryable: false });
  return null;
}
