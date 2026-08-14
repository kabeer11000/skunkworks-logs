import { atom } from "nanostores";
const IDENTITY_KEY = 'sk_identity';

export interface Identity {
  publicUserId: string;
  name: string;
  color: string;
  email: string;
}
export async function deriveIdentity(email: string, name: string): Promise<Identity> {
  const normalized = email.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  const hashHex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');

  const publicUserId = hashHex.slice(0, 12);
  const hue = parseInt(hashHex.slice(0, 8), 16) % 360;
  const color = `hsl(${hue}, 35%, 45%)`;

  return { publicUserId, name, color, email: normalized };
}

export function getStoredIdentityClient() {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp('(^|;\\s*)' + IDENTITY_KEY + '=([^;]+)'));
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Parses the raw HTTP 'Cookie' header string to find the identity.
 * Usage: getStoredIdentityServer(request.headers.get('cookie'))
 */
export function getStoredIdentityServer(cookieHeaderString: string | null): Identity | null {
  if (!cookieHeaderString) return null;

  const match = cookieHeaderString.match(new RegExp('(^|;\\s*)' + IDENTITY_KEY + '=([^;]+)'));
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch {
      return null;
    }
  }
  return null;
}

export const $identity = atom < Identity > (null);

