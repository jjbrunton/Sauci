import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { registerContentTools } from './tools/content.js';
import { registerUserTools } from './tools/users.js';
import { registerModerationTools } from './tools/moderation.js';
import { registerCodeTools } from './tools/codes.js';
import { registerFeedbackTools } from './tools/feedback.js';
import { registerAnalyticsTools } from './tools/analytics.js';
import { registerConfigTools } from './tools/config.js';
import { registerAdminTools } from './tools/admin.js';

import { Context } from 'hono';

export function createMcpServer() {
  const server = new McpServer({
    name: 'sauci-admin',
    version: '1.0.0',
  });

  // Register all tool groups
  registerContentTools(server);
  registerUserTools(server);
  registerModerationTools(server);
  registerCodeTools(server);
  registerFeedbackTools(server);
  registerAnalyticsTools(server);
  registerConfigTools(server);
  registerAdminTools(server);

  return {
    handleRequest: async (c: Context) => {
      const transport = new StreamableHTTPTransport();
      await server.connect(transport);
      return transport.handleRequest(c);
    }
  };
}
