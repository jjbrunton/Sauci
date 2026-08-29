import { describe, expect, it } from 'vitest';
import { requireLocalApi, requireLoopback } from '../src/load/loopback.js';

describe('representative load fixture boundary', () => {
  it('accepts only loopback API and PostgreSQL URLs', () => {
    expect(requireLoopback('http://127.0.0.1:3003', 'API').hostname).toBe('127.0.0.1');
    expect(requireLoopback('postgresql://sauci:test@localhost:5432/sauci', 'DATABASE').hostname).toBe('localhost');
    expect(() => requireLoopback('https://api.sauci.example', 'API')).toThrow('must resolve to loopback');
    expect(() => requireLoopback('postgresql://sauci:test@db.internal:5432/sauci', 'DATABASE')).toThrow('must resolve to loopback');
  });

  it('allows only the controlled local HTTP API port', () => {
    expect(requireLocalApi('http://127.0.0.1:3003').port).toBe('3003');
    expect(() => requireLocalApi('https://127.0.0.1:3003')).toThrow('must be http loopback');
    expect(() => requireLocalApi('http://127.0.0.1:3004')).toThrow('must be http loopback');
  });
});
