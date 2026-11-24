import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * On-device text recognition (Google ML Kit, Latin script, bundled model).
 * Implemented in android/app/src/main/java/com/warrantformscanner/ocr.
 */
export interface Spec extends TurboModule {
  /**
   * Recognises text in an image file.
   * The region (left/top/width/height) is given as fractions 0..1 of the image;
   * pass 0,0,1,1 for the whole image. The region is upscaled by `scale` and,
   * when `enhance` is true, converted to high-contrast grayscale first.
   * Resolves with a JSON string (see src/services/ocr/types.ts); all coordinates
   * are in pixels of the original, upright image.
   */
  recognize(
    path: string,
    left: number,
    top: number,
    width: number,
    height: number,
    scale: number,
    enhance: boolean,
  ): Promise<string>;
}

// `get` (not `getEnforcing`) so platforms without the module (iOS) can fall back.
export default TurboModuleRegistry.get<Spec>('WarrantOcr');
