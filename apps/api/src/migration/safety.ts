const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

function parseDatabaseUrl(label: string, value: string | undefined): URL {
  if (!value) throw new Error(`${label} is required`);
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be a valid PostgreSQL URL`); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error(`${label} must use postgres:// or postgresql://`);
  if (!parsed.hostname || !parsed.pathname.slice(1)) throw new Error(`${label} must identify a host and database`);
  return parsed;
}

function databaseIdentity(url: URL): string {
  return `${url.hostname.toLowerCase()}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function validateEndpoints(sourceValue: string | undefined, targetValue: string | undefined, allowlistValue?: string): { source: string; target: string } {
  const source = parseDatabaseUrl('SOURCE_DATABASE_URL', sourceValue);
  const target = parseDatabaseUrl('TARGET_DATABASE_URL', targetValue);
  if (databaseIdentity(source) === databaseIdentity(target)) throw new Error('Source and target must be different PostgreSQL databases');
  const allowlist = new Set((allowlistValue ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (!LOCAL_HOSTS.has(target.hostname.toLowerCase()) && !allowlist.has(target.hostname.toLowerCase())) {
    throw new Error(`Target host is not allowlisted; add it explicitly to MIGRATION_TARGET_HOST_ALLOWLIST`);
  }
  return { source: source.toString(), target: target.toString() };
}

export function redactDatabaseUrl(value: string): string {
  const parsed = new URL(value); parsed.username = parsed.username ? '***' : ''; parsed.password = parsed.password ? '***' : '';
  return parsed.toString();
}
