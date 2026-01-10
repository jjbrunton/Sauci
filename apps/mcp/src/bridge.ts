import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const args = process.argv.slice(2);
const urlArg = args.find(a => a.startsWith('--url='));
const keyArg = args.find(a => a.startsWith('--key='));

if (!urlArg || !keyArg) {
  console.error('Usage: node bridge.js --url=<url> --key=<key>');
  process.exit(1);
}

const url = new URL(urlArg.split('=')[1]);
const apiKey = keyArg.split('=')[1];

async function run() {
  console.error(`[Bridge] Connecting to ${url.href}`);
  console.error(`[Bridge] Using API Key (length: ${apiKey.length})`);

  const local = new StdioServerTransport();

  const remote = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json, text/event-stream'
      }
    }
  });

  // Bridge messages from Claude Desktop to remote server
  local.onmessage = async (message) => {
    console.error(`[Bridge] -> Remote: ${JSON.stringify(message).slice(0, 100)}...`);
    try {
      await remote.send(message);
    } catch (err) {
      console.error('[Bridge] Failed to forward message to remote:', err);
    }
  };

  // Bridge messages from remote server to Claude Desktop
  remote.onmessage = async (message) => {
    console.error(`[Bridge] <- Remote: ${JSON.stringify(message).slice(0, 100)}...`);
    try {
      await local.send(message);
    } catch (err) {
      console.error('[Bridge] Failed to forward message to local:', err);
    }
  };

  remote.onerror = (err) => {
    console.error('[Bridge] Remote transport error:', err);
  };

  local.onerror = (err) => {
    console.error('[Bridge] Local transport error:', err);
    process.exit(1);
  };

  local.onclose = () => {
    console.error('[Bridge] Local transport closed');
    process.exit(0);
  };

  remote.onclose = () => {
    console.error('[Bridge] Remote transport closed');
  };

  // Start both transports
  console.error('[Bridge] Starting remote transport...');
  await remote.start();
  console.error('[Bridge] Remote transport started');

  console.error('[Bridge] Starting local transport...');
  await local.start();
  console.error('[Bridge] Local transport started - ready for messages');
}

run().catch(err => {
  console.error('[Bridge] Fatal error:', err);
  process.exit(1);
});
