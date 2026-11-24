import type { OcrLine, OcrPass, OcrResult } from './types';

/**
 * Where to look for the printed warrant "No". It sits in the top-right corner
 * ("No  D/1 282681"). Reading a 2× crop of that corner is ~8× faster than the
 * whole photo and was as accurate on the sample warrants; the full photo is the
 * fallback in case the form is framed unusually.
 */
export const NO_PASSES: OcrPass[] = [
  { left: 0.4, top: 0, width: 0.6, height: 0.4, scale: 2, enhance: false },
  { left: 0, top: 0, width: 1, height: 1, scale: 1, enhance: false },
];

interface Candidate {
  value: string;
  /** Horizontal centre as a fraction of the image width. */
  cx: number;
  hasPrefix: boolean;
}

function center(line: OcrLine, r: OcrResult) {
  const f = line.frame;
  if (!f || !r.width || !r.height) {
    return null;
  }
  return {
    cx: (f.left + f.width / 2) / r.width,
    cy: (f.top + f.height / 2) / r.height,
  };
}

/**
 * Finds the printed serial number in OCR output.
 *
 * The top-right corner also contains the rubber-stamped department code
 * (e.g. "3929/2", sometimes read with junk such as "342928à") to the LEFT of the
 * serial. So candidates are 6-digit runs (5–7 as a fallback) in the top-right
 * area, preferring ones printed after the "D" of "D/1", then the rightmost.
 */
export function extractNo(result: OcrResult): string {
  const candidates: Candidate[] = [];
  for (const line of result.lines) {
    const c = center(line, result);
    if (!c || c.cy > 0.4 || c.cx < 0.55) {
      continue;
    }
    // "D 559424", "D559471", "282681" – spaces inside the number are OCR noise.
    const compact = line.text.replace(/\s+/g, '');
    for (const m of compact.matchAll(/(D)?(\d{5,7})(?!\d)/g)) {
      const index = m.index ?? 0;
      // Skip digit runs glued to other digits/slashes, e.g. the stamp "3929/2".
      if (!m[1] && index > 0 && /[\d/]/.test(compact[index - 1])) {
        continue;
      }
      candidates.push({ value: m[2], cx: c.cx, hasPrefix: Boolean(m[1]) });
    }
  }
  if (candidates.length === 0) {
    return '';
  }
  const score = (k: Candidate) =>
    (k.value.length === 6 ? 2 : 0) + (k.hasPrefix ? 1 : 0) + k.cx;
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0].value;
}
