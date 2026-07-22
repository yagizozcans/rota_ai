import ImageResizer from '@bam.tech/react-native-image-resizer';
import { decode as decodeJpeg } from 'jpeg-js';
import { config } from '../config';
import { readBase64 } from '../storage/files';
import { base64ToBytes, blurScoreFromRgba } from './blur';

/**
 * Device glue for blur detection (01 §3.5, plan Q2): turn a captured JPEG into a
 * blur score. The photo is FIRST downscaled natively to BLUR_ANALYSIS_WIDTH — we
 * never JS-decode a full 12 MP frame (that would block the UI thread) — then the
 * small JPEG is decoded to RGBA and scored by the pure pipeline in blur.ts.
 *
 * NOTE: the native resize (@bam.tech/react-native-image-resizer) could not be
 * built/verified in this environment; the scoring maths is unit-tested.
 */
export async function analyzeBlur(tempPath: string): Promise<number> {
  const resized = await ImageResizer.createResizedImage(
    tempPath,
    config.BLUR_ANALYSIS_WIDTH,
    config.BLUR_ANALYSIS_WIDTH,
    'JPEG',
    80,
  );
  const bytes = base64ToBytes(await readBase64(resized.uri));
  const { data, width, height } = decodeJpeg(bytes, { useTArray: true });
  return blurScoreFromRgba(data, width, height);
}
