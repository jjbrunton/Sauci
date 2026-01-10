import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authMiddleware } from './lib/auth.js';
import { createMcpServer } from './server.js';

const app = new Hono();

app.use('*', logger());
app.use('/mcp', authMiddleware);

app.get('/health', (c) => c.json({ status: 'ok', service: 'sauci-mcp' }));

// Initialize MCP server
const mcpServer = createMcpServer();

// Mount MCP server
app.all('/mcp', async (c) => {
  // Add headers to prevent Nginx/proxy buffering for SSE
  c.header('X-Accel-Buffering', 'no');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  
  return mcpServer.handleRequest(c.req.raw);
});

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
