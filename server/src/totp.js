import crypto from 'node:crypto';

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(value || '').toUpperCase().replace(/[=\s-]/g, '');
  if (!clean || [...clean].some((character) => !alphabet.includes(character))) return null;
  let bits = '';
  for (const character of clean) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

function codeAt(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, '0');
}

export function verifyAdminTotp(code, secretValue, now = Date.now()) {
  const secret = decodeBase32(secretValue);
  if (!secret || secret.length < 16 || !/^\d{6}$/.test(String(code || ''))) return false;
  const currentStep = Math.floor(now / 30_000);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    const expected = Buffer.from(codeAt(secret, step));
    const supplied = Buffer.from(String(code));
    if (expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)) return true;
  }
  return false;
}
