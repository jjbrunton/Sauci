/**
 * Admin Key Generation Script for E2EE
 *
 * Run this to generate an admin RSA-2048 key pair for E2EE.
 *
 * Usage:
 *   node scripts/generate-admin-keys.mjs           # Generate new key
 *   node scripts/generate-admin-keys.mjs --rotate  # Generate for rotation (shows migration steps)
 *
 * Output:
 * - PUBLIC KEY: Store in master_keys table via Supabase dashboard or migration
 * - PRIVATE KEY: Store in environment variables for Supabase Edge Functions
 *
 * IMPORTANT: Never commit the private key to version control!
 */

import { webcrypto, randomUUID } from 'crypto';

const isRotation = process.argv.includes('--rotate');

async function generateAdminKeyPair() {
  console.log('Generating RSA-2048 key pair for E2EE admin access...\n');

  // Generate a UUID for this key (used in keys_metadata.admin_key_id)
  const keyId = randomUUID();
  const keyName = `e2ee_admin_key_${Date.now()}`;

  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);

  console.log('='.repeat(80));
  console.log(`KEY ID: ${keyId}`);
  console.log('='.repeat(80));
  console.log('\nSave this ID - it will be stored in messages and used for key lookup.\n');

  console.log('='.repeat(80));
  console.log('PUBLIC KEY (store in master_keys table)');
  console.log('='.repeat(80));

  if (isRotation) {
    console.log('\n1. First, mark old key as inactive:\n');
    console.log(`UPDATE master_keys SET is_active = false WHERE is_active = true;`);
    console.log('\n2. Then insert the new key:\n');
  } else {
    console.log('\nRun this SQL in Supabase dashboard or create a migration:\n');
  }

  console.log(`INSERT INTO master_keys (id, key_name, public_key_jwk, is_active)
VALUES ('${keyId}', '${keyName}', '${JSON.stringify(publicKeyJwk)}'::jsonb, true);`);

  console.log('\n');
  console.log('='.repeat(80));
  console.log('PRIVATE KEY - SINGLE KEY FORMAT (backwards compatible)');
  console.log('='.repeat(80));
  console.log('\nFor first-time setup, add this to Supabase Edge Function secrets:\n');
  console.log('Key name: ADMIN_PRIVATE_KEY_JWK');
  console.log('Value (single line):');
  console.log(JSON.stringify(privateKeyJwk));

  console.log('\n');
  console.log('='.repeat(80));
  console.log('PRIVATE KEY - MULTI-KEY FORMAT (for key rotation)');
  console.log('='.repeat(80));
  console.log('\nFor key rotation support, use ADMIN_KEYS_JSON instead:\n');
  console.log('Key name: ADMIN_KEYS_JSON');
  console.log('Value format: { "key-id-1": {...jwk...}, "key-id-2": {...jwk...} }');
  console.log('\nFor this new key, add to your existing ADMIN_KEYS_JSON:');
  console.log(`"${keyId}": ${JSON.stringify(privateKeyJwk)}`);

  if (isRotation) {
    console.log('\n');
    console.log('='.repeat(80));
    console.log('KEY ROTATION CHECKLIST');
    console.log('='.repeat(80));
    console.log(`
1. [ ] Run the SQL above to insert new public key and deactivate old one
2. [ ] Add the new private key to ADMIN_KEYS_JSON (keep the old key!)
3. [ ] Deploy updated edge functions
4. [ ] Test that new messages use the new key
5. [ ] Test that old messages can still be decrypted
6. [ ] (Optional) After 90+ days, remove old key from ADMIN_KEYS_JSON
`);
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('IMPORTANT SECURITY NOTES');
  console.log('='.repeat(80));
  console.log(`
1. NEVER commit the private key to version control
2. Store the private key securely in Supabase Edge Function secrets
3. The public key can be safely stored in the database
4. Keep a secure backup of the private key offline
5. If the private key is compromised, rotate immediately
6. When rotating keys, keep old private keys until all messages are migrated
`);

  // Also output a JSON file for backup (to stderr so it can be redirected)
  console.error('\n--- KEY BACKUP (redirect stderr to save) ---');
  console.error(JSON.stringify({
    keyId,
    keyName,
    publicKeyJwk,
    privateKeyJwk,
    generatedAt: new Date().toISOString(),
  }, null, 2));
}

generateAdminKeyPair().catch(console.error);
