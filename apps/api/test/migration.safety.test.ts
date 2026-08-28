import { describe, expect, it } from 'vitest';
import { redactDatabaseUrl, validateEndpoints } from '../src/migration/safety.js';

describe('migration endpoint safety', () => {
  it('requires explicit source and target URLs', () => {
    expect(() => validateEndpoints(undefined, 'postgres://x:y@localhost/target')).toThrow('SOURCE_DATABASE_URL is required');
    expect(() => validateEndpoints('postgres://x:y@localhost/source', undefined)).toThrow('TARGET_DATABASE_URL is required');
  });
  it('rejects the same physical database even when query options differ', () => {
    expect(() => validateEndpoints('postgres://x:y@localhost/sauci?options=source', 'postgres://a:b@localhost/sauci?options=target')).toThrow('must be different');
  });
  it('allows local targets and requires an explicit remote target allowlist', () => {
    expect(validateEndpoints('postgres://x:y@source.example/source', 'postgres://a:b@127.0.0.1/target').target).toContain('127.0.0.1');
    expect(() => validateEndpoints('postgres://x:y@source.example/source', 'postgres://a:b@db.example/target')).toThrow('not allowlisted');
    expect(validateEndpoints('postgres://x:y@source.example/source', 'postgres://a:b@db.example/target', 'db.example').target).toContain('db.example');
  });
  it('redacts database credentials', () => {
    const redacted = redactDatabaseUrl('postgres://secret-user:secret-password@db.example/sauci');
    expect(redacted).not.toContain('secret-user'); expect(redacted).not.toContain('secret-password');
  });
});
