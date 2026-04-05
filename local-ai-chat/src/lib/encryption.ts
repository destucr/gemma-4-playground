/**
 * Encryption Utility for the Intelligence Lab.
 * Uses AES-GCM for authenticated client-side encryption.
 */

const KEY_ALIAS = 'lab-encryption-key';

/**
 * Gets or creates a persistent encryption key stored in localStorage.
 */
export async function getOrCreateKey(): Promise<CryptoKey> {
  const savedKey = localStorage.getItem(KEY_ALIAS);
  
  if (savedKey) {
    const rawKey = Uint8Array.from(atob(savedKey), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
      'raw',
      rawKey,
      'AES-GCM',
      true,
      ['encrypt', 'decrypt']
    );
  }

  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await window.crypto.subtle.exportKey('raw', key);
  const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));
  localStorage.setItem(KEY_ALIAS, base64Key);
  
  return key;
}

/**
 * Encrypts a string and returns a combined IV + Ciphertext string.
 */
export async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a combined IV + Ciphertext string.
 * Returns the original text or the raw string if decryption fails (fallback for legacy data).
 */
export async function decrypt(base64Data: string, key: CryptoKey): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, it might be legacy plain text
    return base64Data;
  }
}
