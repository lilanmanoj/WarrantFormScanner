import fixtures from './fixtures/mlkit-top-right.json';
import { extractNo } from '../src/services/ocr/extractFields';
import type { OcrResult } from '../src/services/ocr/types';

/**
 * Real ML Kit output (top-right region only) captured from the 8 sample
 * warrants on an Android emulator via OcrDebugActivity.
 */
describe('extractNo on real ML Kit output', () => {
  for (const f of fixtures) {
    it(`${f.sample}: top-right 2x pass -> ${f.expectedNo}`, () => {
      expect(extractNo(f.topright_x2 as OcrResult)).toBe(f.expectedNo);
    });
    it(`${f.sample}: full-image pass -> ${f.expectedNo}`, () => {
      expect(extractNo(f.full as OcrResult)).toBe(f.expectedNo);
    });
  }
});

describe('extractNo edge cases', () => {
  const r = (lines: [string, number, number][]): OcrResult => ({
    width: 1000,
    height: 1000,
    lines: lines.map(([text, cx, cy]) => ({
      text,
      frame: { left: cx * 1000 - 50, top: cy * 1000 - 10, width: 100, height: 20 },
      elements: [],
    })),
  });

  it('ignores the stamped department code even when misread as 6 digits', () => {
    expect(extractNo(r([['342928', 0.58, 0.14], ['282681', 0.8, 0.15]]))).toBe('282681');
  });
  it('ignores numbers outside the top-right area', () => {
    expect(extractNo(r([['559952', 0.3, 0.14], ['123456', 0.8, 0.8]]))).toBe('');
  });
  it('does not take part of a longer number', () => {
    expect(extractNo(r([['3929 2 882', 0.6, 0.2]]))).toBe('');
  });
});
