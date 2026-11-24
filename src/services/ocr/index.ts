import NativeWarrantOcr from '../../../specs/NativeWarrantOcr';
import type { WarrantExtraction } from '../gemini';
import { extractNo, NO_PASSES } from './extractFields';
import type { OcrPass, OcrResult } from './types';

export function isDeviceOcrAvailable(): boolean {
  return NativeWarrantOcr != null;
}

async function recognize(path: string, pass: OcrPass): Promise<OcrResult> {
  if (!NativeWarrantOcr) {
    throw new Error('The built-in reader is only available on Android. Choose Gemini AI in Settings.');
  }
  const json = await NativeWarrantOcr.recognize(
    path,
    pass.left,
    pass.top,
    pass.width,
    pass.height,
    pass.scale,
    pass.enhance,
  );
  return JSON.parse(json) as OcrResult;
}

/**
 * Reads the printed "No" with on-device OCR.
 *
 * The handwritten Total is deliberately left empty: ML Kit's on-device model is
 * built for printed text and misread the handwritten totals on the sample
 * warrants (e.g. "3300" -> "930"). A wrong pre-filled amount is easy to accept
 * by mistake, so the review screen asks the user to type the Total instead.
 */
export async function readWarrantOnDevice(path: string): Promise<WarrantExtraction> {
  let warrantNo = '';
  for (const pass of NO_PASSES) {
    warrantNo = extractNo(await recognize(path, pass));
    if (warrantNo) {
      break;
    }
  }
  return {
    warrantNo,
    total: '',
    notes: warrantNo
      ? 'Type the handwritten Total.'
      : 'No not found – type the No and Total.',
  };
}
