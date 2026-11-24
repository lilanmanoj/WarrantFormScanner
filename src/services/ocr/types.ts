export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrElement {
  text: string;
  frame: Frame | null;
}

export interface OcrLine {
  text: string;
  frame: Frame | null;
  elements: OcrElement[];
}

/** Output of the native WarrantOcr.recognize (coordinates in original image pixels). */
export interface OcrResult {
  width: number;
  height: number;
  lines: OcrLine[];
}

/** A region of the image as fractions 0..1, plus how much to upscale it before OCR. */
export interface OcrPass {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  enhance: boolean;
}
