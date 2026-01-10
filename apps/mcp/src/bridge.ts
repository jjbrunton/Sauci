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

  // 1. Diagnostic Fetch
  try {
    const response = await fetch(url.href, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream'
      }
    });

    console.error(`[Bridge] Diagnostic fetch status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      console.error('[Bridge] Critical: Server returned 401 Unauthorized.');
      console.error('[Bridge] Please verify SAUCI_MCP_API_KEY environment variable on the server matches the key in Claude Desktop config.');
      const text = await response.text();
      console.error(`[Bridge] Server response: ${text}`);
      process.exit(1);
    } else if (!response.ok) {
       console.error(`[Bridge] Diagnostic fetch failed with status ${response.status}`);
       const text = await response.text();
       console.error(`[Bridge] Server response: ${text}`);
    } else {
       console.error('[Bridge] Diagnostic fetch successful (connection accepted). Proceeding with StreamableHTTP.');
       // Cancel body to close connection
       await response.body?.cancel();
    }
  } catch (error) {
    console.error('[Bridge] Diagnostic fetch failed with network error:', error);
  }

  const local = new StdioServerTransport();
  
  const remote = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }
  });

  // Bridge messages
  local.onmessage = async (message) => {
    try {
      await remote.send(message);
    } catch (err) {
      console.error('Failed to forward message to remote:', err);
    }
  };

  remote.onmessage = async (message) => {
    try {
      await local.send(message);
    } catch (err) {
      console.error('Failed to forward message to local:', err);
    }
  };

  remote.onerror = (err) => {
    console.error('Remote transport error:', err);
    // Don't exit process immediately on error, allow reconnection logic if handled by transport,
    // but StreamableHTTPClientTransport usually handles its own reconnection for SSE.
    // If it's a fatal error, maybe we should exit?
    // Let's log it.
  };

  local.onerror = (err) => {
    console.error('Local transport error:', err);
    process.exit(1);
  };

  // Start connections
  await remote.start();
  
  // Keep process alive
  process.stdin.resume();
}

run().catch(err => {
  console.error('Bridge error:', err);
  process.exit(1);
});

