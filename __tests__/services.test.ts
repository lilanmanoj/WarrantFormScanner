import { KEYUTIL, KJUR } from 'jsrsasign';

// Provided by Node in the Jest environment.
declare const Buffer: { from(b: Uint8Array): { toString(enc: string): string } };
import { normalizeTotal, normalizeWarrantNo, pickDefaultModel } from '../src/services/gemini';
import { parseServiceAccount, parseSpreadsheetUrl } from '../src/services/sheets';
import { arrayBufferToBase64 } from '../src/utils/base64';

describe('normalizeTotal', () => {
  it.each([
    ['2050:00', '2050:00'],
    ['2050', '2050:00'],
    ['6400/-', '6400:00'],
    ['6400.5', '6400:50'],
    ['Rs. 2,050:00', '2050:00'],
    ['2050/=', '2050:00'],
    ['', ''],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeTotal(input)).toBe(expected);
  });
});

describe('normalizeWarrantNo', () => {
  it('keeps digits only', () => {
    expect(normalizeWarrantNo('282 681')).toBe('282681');
    expect(normalizeWarrantNo('559 952')).toBe('559952');
  });
});

describe('parseSpreadsheetUrl', () => {
  it('extracts id and gid', () => {
    expect(
      parseSpreadsheetUrl('https://docs.google.com/spreadsheets/d/1AbC-d_9/edit?usp=sharing#gid=12345'),
    ).toEqual({ spreadsheetId: '1AbC-d_9', gid: 12345 });
    expect(parseSpreadsheetUrl('https://docs.google.com/spreadsheets/d/XYZ/edit')).toEqual({
      spreadsheetId: 'XYZ',
      gid: undefined,
    });
    expect(parseSpreadsheetUrl('https://example.com')).toBeNull();
  });
});

describe('arrayBufferToBase64', () => {
  it('matches Buffer encoding', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 100, 70000]) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 37 + 11) % 256);
      expect(arrayBufferToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });
});

describe('pickDefaultModel', () => {
  it('prefers newest stable flash', () => {
    const models = ['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.5-pro', 'models/gemini-2.5-flash-lite', 'models/gemini-3.0-flash-preview'].map(
      name => ({ name, displayName: name }),
    );
    expect(pickDefaultModel(models)).toBe('models/gemini-3.0-flash-preview');
    expect(pickDefaultModel(models.slice(0, 4))).toBe('models/gemini-2.5-flash');
  });
});

describe('service account JWT', () => {
  it('signs an RS256 JWT that verifies with the public key', () => {
    const kp = KEYUTIL.generateKeypair('RSA', 1024);
    const pem = KEYUTIL.getPEM(kp.prvKeyObj, 'PKCS8PRV');
    const sa = parseServiceAccount(
      JSON.stringify({ type: 'service_account', client_email: 'a@b.iam.gserviceaccount.com', private_key: pem }),
    );
    expect(sa.token_uri).toBe('https://oauth2.googleapis.com/token');
    const jwt = KJUR.jws.JWS.sign('RS256', '{"alg":"RS256","typ":"JWT"}', '{"iss":"x"}', sa.private_key);
    expect(KJUR.jws.JWS.verify(jwt, kp.pubKeyObj, ['RS256'])).toBe(true);
  });

  it('rejects non service-account JSON', () => {
    expect(() => parseServiceAccount('{"type":"authorized_user"}')).toThrow();
    expect(() => parseServiceAccount('nope')).toThrow();
  });
});
