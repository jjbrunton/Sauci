import { Context, Next } from 'hono';

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = process.env.SAUCI_MCP_API_KEY;

  if (!apiKey) {
    // If no API key is set in env, allow access (warn in logs)
    // Ideally this should default to deny, but for dev ease we might want to warn
    console.warn('SAUCI_MCP_API_KEY not set in environment - allowing all requests');
    return next();
  }

  let token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    token = c.req.query('apiKey');
  }

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization header or apiKey query param' }, 401);
  }

  if (token !== apiKey) {
    return c.json({ error: 'Unauthorized: Invalid API key' }, 401);
  }

  return next();
};
