/** Refuse fixture targets outside the local development boundary. */
export function requireLoopback(url: string, name: string): URL {
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error(`${name} must resolve to loopback; refusing non-local load`);
  }
  return parsed;
}

export function requireLocalApi(url: string, expectedPort = 3003): URL {
  const parsed = requireLoopback(url, 'SAUCI_LOAD_API_URL');
  if (parsed.protocol !== 'http:' || Number(parsed.port || 80) !== expectedPort) {
    throw new Error(`SAUCI_LOAD_API_URL must be http loopback on port ${expectedPort}`);
  }
  return parsed;
}
