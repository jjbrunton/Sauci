import { decode, encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

export interface KeysMetadata {
  sender_wrapped_key: string;
  recipient_wrapped_key?: string;
  admin_wrapped_key: string;
  admin_key_id: string;
  algorithm: string;
  key_wrap_algorithm: string;
  pending_recipient?: boolean;
}

export async function unwrapWithAdminKey(
  wrappedKeyBase64: string,
  adminPrivateKeyJwk: JsonWebKey
): Promise<ArrayBuffer> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    adminPrivateKeyJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  return await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToUint8Array(wrappedKeyBase64)
  );
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return decode(base64);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return encode(buffer);
}
