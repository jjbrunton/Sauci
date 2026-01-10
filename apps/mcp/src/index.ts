import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authMiddleware } from './lib/auth.js';
import { createMcpServer } from './server.js';

const app = new Hono();

app.use('*', logger());
app.use('/mcp', authMiddleware);
app.use('/mcp/*', authMiddleware);

app.get('/health', (c) => c.json({ status: 'ok', service: 'sauci-mcp' }));

// Initialize MCP server with StreamableHTTP transport
const mcpServer = createMcpServer();

// StreamableHTTP endpoint - handles all MCP communication
app.all('/mcp', async (c) => {
  return mcpServer.handleRequest(c);
});

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
