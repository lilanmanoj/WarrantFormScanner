import { KJUR } from 'jsrsasign';

/**
 * Google Sheets client authenticated with a Google Cloud service account.
 *
 * The app signs a JWT with the service account's private key, exchanges it for
 * an OAuth access token, and calls the Sheets REST API. The target spreadsheet
 * must be shared (as Editor) with the service account's `client_email`.
 */

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export function parseServiceAccount(json: string): ServiceAccount {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Service account key is not valid JSON.');
  }
  if (data?.type !== 'service_account') {
    throw new Error('JSON is not a service account key ("type" must be "service_account").');
  }
  if (!data.client_email || !data.private_key) {
    throw new Error('Service account key is missing "client_email" or "private_key".');
  }
  return {
    client_email: data.client_email,
    private_key: data.private_key,
    token_uri: data.token_uri || 'https://oauth2.googleapis.com/token',
  };
}

export interface SpreadsheetRef {
  spreadsheetId: string;
  /** Tab id from "#gid=…" in the URL, if present. */
  gid?: number;
}

export function parseSpreadsheetUrl(url: string): SpreadsheetRef | null {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) {
    return null;
  }
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
  return { spreadsheetId: id, gid: gid !== undefined ? Number(gid) : undefined };
}

// ---- Access token (cached in memory until shortly before expiry) ----

let cachedToken: { email: string; token: string; expiresAt: number } | null = null;

export async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.expiresAt - 60 > now) {
    return cachedToken.token;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: SHEETS_SCOPE,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  let assertion: string;
  try {
    assertion = KJUR.jws.JWS.sign('RS256', JSON.stringify(header), JSON.stringify(claims), sa.private_key);
  } catch (e: any) {
    throw new Error(`Could not sign with the service account private key: ${e?.message ?? e}`);
  }

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      'grant_type=' +
      encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
      '&assertion=' +
      encodeURIComponent(assertion),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    const msg = body?.error_description ?? body?.error ?? `HTTP ${res.status}`;
    throw new Error(`Google sign-in with service account failed: ${msg}`);
  }

  cachedToken = {
    email: sa.client_email,
    token: body.access_token,
    expiresAt: now + Number(body.expires_in ?? 3600),
  };
  return body.access_token;
}

async function sheetsFetch(token: string, url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        `${msg}\n\nMake sure the sheet is shared (Editor access) with the service account email shown in Settings.`,
      );
    }
    throw new Error(`Google Sheets error: ${msg}`);
  }
  return body;
}

/** Resolves the tab title for the URL's gid (or the first tab). Also verifies access. */
export async function resolveSheetTitle(sa: ServiceAccount, ref: SpreadsheetRef): Promise<string> {
  const token = await getAccessToken(sa);
  const body = await sheetsFetch(
    token,
    `${SHEETS_API}/${ref.spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  );
  const sheets: { properties: { sheetId: number; title: string } }[] = body?.sheets ?? [];
  if (sheets.length === 0) {
    throw new Error('The spreadsheet has no tabs.');
  }
  const match = ref.gid !== undefined ? sheets.find(s => s.properties.sheetId === ref.gid) : undefined;
  return (match ?? sheets[0]).properties.title;
}

/** Appends one row after the last row with data in the given tab. */
export async function appendRow(
  sa: ServiceAccount,
  spreadsheetId: string,
  sheetTitle: string,
  row: (string | number)[],
): Promise<void> {
  const token = await getAccessToken(sa);
  const range = encodeURIComponent(`'${sheetTitle.replace(/'/g, "''")}'!A1`);
  await sheetsFetch(
    token,
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ majorDimension: 'ROWS', values: [row] }),
    },
  );
}
