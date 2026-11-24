/* eslint-disable no-bitwise */
const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encodes binary data to a base64 string (no dependency on btoa/Buffer). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  const parts: string[] = [];
  // Build in chunks so we don't create one enormous intermediate string per byte.
  const CHUNK = 3 * 8192;
  for (let start = 0; start < len; start += CHUNK) {
    const end = Math.min(start + CHUNK, len);
    let out = '';
    for (let i = start; i < end; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < end ? bytes[i + 1] : 0;
      const b2 = i + 2 < end ? bytes[i + 2] : 0;
      out += CHARS[b0 >> 2];
      out += CHARS[((b0 & 3) << 4) | (b1 >> 4)];
      out += i + 1 < end ? CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
      out += i + 2 < end ? CHARS[b2 & 63] : '=';
    }
    parts.push(out);
  }
  return parts.join('');
}
