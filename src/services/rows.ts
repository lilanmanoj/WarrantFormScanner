import { normalizeTotal } from './gemini';

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

/**
 * Builds the sheet row: Category | No | Total | Scanned at.
 * "No" is stored as a number unless it has a leading zero; Total is normalised
 * to "rupees:cents" when it looks like an amount, otherwise kept as typed.
 */
export function buildWarrantRow(
  category: string,
  warrantNo: string,
  total: string,
): (string | number)[] {
  const no = warrantNo.trim();
  const noCell: string | number = /^[1-9]\d*$/.test(no) ? Number(no) : no;
  const totalCell = normalizeTotal(total) || total.trim();
  return [category, noCell, totalCell, timestamp()];
}
