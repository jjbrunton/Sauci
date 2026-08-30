import { expect, test } from '@playwright/test';

const mcp = process.env.MCP_URL;
if (!mcp) throw new Error('Run E2E through npm run verify:e2e');

test('MCP health is available while tool access requires auth', async ({ request }) => {
  const health = await request.get(`${mcp}/health`);
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'sauci-mcp' });
  const tools = await request.post(`${mcp}/mcp`);
  expect(tools.status()).toBe(401);
});
