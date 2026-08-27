import { Context, Next } from 'hono';

export const authMiddleware = async (c: Context, next: Next) => {
  const apiKey = process.env.SAUCI_MCP_API_KEY;

  if (!apiKey) {
    console.error('SAUCI_MCP_API_KEY is not configured; refusing MCP access');
    return c.json({ error: 'Service authentication is not configured' }, 503);
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;

  if (!token) {
    return c.json({ error: 'Unauthorized: Bearer token required' }, 401);
  }

  if (token !== apiKey) {
    return c.json({ error: 'Unauthorized: Invalid API key' }, 401);
  }

  return next();
};
