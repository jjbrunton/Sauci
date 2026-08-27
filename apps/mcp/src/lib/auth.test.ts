import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { authMiddleware } from './auth.js';

function app() {
  const instance = new Hono();
  instance.use('/mcp', authMiddleware);
  instance.get('/mcp', (c) => c.json({ ok: true }));
  return instance;
}

afterEach(() => {
  delete process.env.SAUCI_MCP_API_KEY;
});

describe('MCP authentication', () => {
  it('fails closed when the server key is missing', async () => {
    const response = await app().request('/mcp');
    expect(response.status).toBe(503);
  });

  it('requires and validates a bearer token', async () => {
    process.env.SAUCI_MCP_API_KEY = 'local-test-key';
    expect((await app().request('/mcp')).status).toBe(401);
    expect((await app().request('/mcp', {
      headers: { Authorization: 'Bearer wrong' },
    })).status).toBe(401);
    expect((await app().request('/mcp', {
      headers: { Authorization: 'Bearer local-test-key' },
    })).status).toBe(200);
  });
});
