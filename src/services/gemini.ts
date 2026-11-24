/**
 * Minimal client for the Gemini API (generativelanguage.googleapis.com).
 *
 * Authentication uses a Gemini API key created in Google AI Studio
 * (https://aistudio.google.com/apikey) – the same key the Gemini CLI accepts
 * via GEMINI_API_KEY.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiModel {
  /** Full resource name, e.g. "models/gemini-2.5-flash". */
  name: string;
  displayName: string;
}

export interface WarrantExtraction {
  warrantNo: string;
  total: string;
  /** Free-text note from the model, e.g. which value it was unsure about. */
  notes: string;
}

export class GeminiApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function geminiFetch(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<any> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON error page
  }
  if (!res.ok) {
    const message = body?.error?.message ?? text.slice(0, 300);
    throw new GeminiApiError(`Gemini API error (${res.status}): ${message}`, res.status);
  }
  return body;
}

/**
 * Lists the models this API key can use for generateContent.
 * Doubles as a connection / credential check.
 */
export async function listGeminiModels(apiKey: string): Promise<GeminiModel[]> {
  const models: GeminiModel[] = [];
  let pageToken: string | undefined;
  do {
    const query = `pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const body = await geminiFetch(apiKey, `models?${query}`);
    for (const m of body?.models ?? []) {
      const methods: string[] = m.supportedGenerationMethods ?? [];
      if (
        methods.includes('generateContent') &&
        typeof m.name === 'string' &&
        m.name.includes('gemini') &&
        !/embedding|tts|image-generation|live|audio/i.test(m.name)
      ) {
        models.push({ name: m.name, displayName: m.displayName ?? m.name });
      }
    }
    pageToken = body?.nextPageToken;
  } while (pageToken);
  return models;
}

/**
 * Picks a sensible default model: the newest stable "flash" model
 * (fast + cheap, and good at reading handwriting).
 */
export function pickDefaultModel(models: GeminiModel[]): string {
  const score = (name: string) => {
    const version = parseFloat(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
    let s = version * 100;
    if (/flash/.test(name)) s += 50;
    if (/lite/.test(name)) s -= 30;
    if (/preview|exp|latest/.test(name)) s -= 20;
    return s;
  };
  const sorted = [...models].sort((a, b) => score(b.name) - score(a.name));
  return sorted[0]?.name ?? '';
}

const EXTRACTION_PROMPT = `You are reading a photo of a Sri Lanka Government Railway "Passenger Warrant" form.
Extract exactly two values:

1. "warrantNo": the printed serial number in the TOP-RIGHT corner, next to the label "No" (අංකය).
   It is printed after a small "D/1" fraction, e.g. "D/1 282681" -> "282681".
   Return digits only. Do NOT return the "D/1" prefix, and do NOT return the rubber-stamped
   department code that is in a box to the left of it (e.g. "3929/2").

2. "total": the HANDWRITTEN amount in the "Total" (එකතුව / மொத்தம்) row at the BOTTOM-RIGHT of the
   "Particulars" table, inside the "Amount" (වටිනාකම) column. That column has a "Rs." (rupees)
   sub-column and a "c" (cents) sub-column.
   Return it as "<rupees>:<cents>" with exactly two cent digits, e.g. "2050:00".
   If the cents cell is blank, a dash, a tick or a scribble, use "00".
   Do NOT use the "Fare" column or the "No. of Tickets" column.

If a value is truly unreadable, return an empty string for it and explain in "notes".
Keep "notes" short (empty if both values were clear).`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    warrantNo: { type: 'STRING' },
    total: { type: 'STRING' },
    notes: { type: 'STRING' },
  },
  required: ['warrantNo', 'total', 'notes'],
};

/** Normalises the "No" to digits only. */
export function normalizeWarrantNo(value: string): string {
  // Drop a "D/1" (or "D / I") prefix if the model included it, then keep digits.
  return (value ?? '').replace(/^\s*D\s*\/\s*[1Il]\s*/i, '').replace(/\D/g, '');
}

/** Normalises the total to "rupees:cents", e.g. "2050" -> "2050:00", "6400.5" -> "6400:50". */
export function normalizeTotal(value: string): string {
  // Commas are thousands separators ("2,050:00").
  const cleaned = (value ?? '').replace(/[^\d:./-]/g, '').trim();
  if (!cleaned) {
    return '';
  }
  const match = cleaned.match(/(\d+)(?:[:./-](\d{0,2}|-))?/);
  if (!match) {
    return ''; // No digits – not an amount.
  }
  const rupees = match[1];
  let cents = match[2] && match[2] !== '-' ? match[2] : '00';
  cents = cents.padEnd(2, '0');
  return `${rupees}:${cents}`;
}

type ThinkingConfig = { thinkingBudget: number } | { thinkingLevel: string };

/**
 * "Thinking" adds several seconds per request and isn't needed to read two
 * fields, so ask for the least thinking each model family allows. Options are
 * tried in order; `undefined` means "send no thinking config" (model default).
 */
export function thinkingOptionsFor(model: string): (ThinkingConfig | undefined)[] {
  const name = model.toLowerCase();
  const major = Number(name.match(/gemini-(\d+)/)?.[1] ?? 0);
  if (major >= 3) {
    return name.includes('pro')
      ? [{ thinkingLevel: 'low' }, undefined]
      : [{ thinkingLevel: 'minimal' }, { thinkingLevel: 'low' }, undefined];
  }
  if (/gemini-2\.5/.test(name)) {
    // 2.5 Pro can't disable thinking; 128 tokens is its minimum.
    return name.includes('pro')
      ? [{ thinkingBudget: 128 }, undefined]
      : [{ thinkingBudget: 0 }, undefined];
  }
  return [undefined]; // Older models don't think.
}

/** Remembers which thinking option each model accepted, to skip failed attempts. */
const acceptedThinking = new Map<string, ThinkingConfig | undefined>();

export async function extractWarrantFields(
  apiKey: string,
  model: string,
  jpegBase64: string,
): Promise<WarrantExtraction> {
  const modelPath = model.startsWith('models/') ? model : `models/${model}`;
  const request = (thinkingConfig: ThinkingConfig | undefined) =>
    geminiFetch(apiKey, `${modelPath}:generateContent`, {
      method: 'POST',
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } },
              { text: EXTRACTION_PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      }),
    });

  const options = acceptedThinking.has(modelPath)
    ? [acceptedThinking.get(modelPath)]
    : thinkingOptionsFor(modelPath);
  let body: any;
  for (let i = 0; i < options.length; i++) {
    try {
      body = await request(options[i]);
      acceptedThinking.set(modelPath, options[i]);
      break;
    } catch (e) {
      // A 400 here means this model rejected the thinking setting – try the next one.
      const isLast = i === options.length - 1;
      if (isLast || !(e instanceof GeminiApiError) || e.status !== 400) {
        throw e;
      }
    }
  }

  const candidate = body?.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');

  if (!text) {
    const reason =
      body?.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'unknown';
    throw new Error(`Gemini returned no result (reason: ${reason}).`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse Gemini response: ${text.slice(0, 200)}`);
  }

  return {
    warrantNo: normalizeWarrantNo(String(parsed.warrantNo ?? '')),
    total: normalizeTotal(String(parsed.total ?? '')),
    notes: String(parsed.notes ?? ''),
  };
}
