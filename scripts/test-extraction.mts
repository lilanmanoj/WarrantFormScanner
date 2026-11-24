/**
 * Runs the same Gemini extraction the app uses against a folder of sample images.
 *
 *   GEMINI_API_KEY=... node scripts/test-extraction.mts [folder] [model]
 *
 * Requires Node >= 22.18 (built-in TypeScript type stripping).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractWarrantFields,
  listGeminiModels,
  pickDefaultModel,
} from '../src/services/gemini.ts';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Set GEMINI_API_KEY first.');
  process.exit(1);
}
const folder = process.argv[2] ?? join(process.env.HOME ?? '', 'Documents/warrant_samples');
const model = process.argv[3] ?? pickDefaultModel(await listGeminiModels(apiKey));
console.log(`Model: ${model}\n`);

for (const file of readdirSync(folder).filter(f => /\.(jpe?g|png)$/i.test(f)).sort()) {
  const base64 = readFileSync(join(folder, file)).toString('base64');
  const started = Date.now();
  try {
    const r = await extractWarrantFields(apiKey, model, base64);
    console.log(
      `${file}\n  No: ${r.warrantNo}\n  Total: ${r.total}${r.notes ? `\n  Notes: ${r.notes}` : ''}\n  (${Date.now() - started} ms)`,
    );
  } catch (e) {
    console.log(`${file}\n  ERROR: ${(e as Error).message}`);
  }
}
