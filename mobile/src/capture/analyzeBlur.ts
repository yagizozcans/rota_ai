import { decode as decodeJpeg } from 'jpeg-js';
import { readBase64 } from '../storage/files';
import { base64ToBytes, blurScoreFromRgba } from './blur';

/**
 * Device glue for blur detection (01 §3.5, plan Q2): turn a captured JPEG into a
 * blur score. Decodes the full-res JPEG with jpeg-js, then the pure pipeline in
 * blur.ts downscales to BLUR_ANALYSIS_WIDTH before scoring.
 *
 * NOTE: an earlier version pre-resized natively via
 * @bam.tech/react-native-image-resizer to avoid decoding a full 12 MP frame on
 * the JS thread. That library's new-architecture podspec hard-depends on
 * `RCT-Folly` as a standalone pod, which no longer resolves under RN 0.86's
 * prebuilt Core/Dependencies binaries (Folly's symbols are baked into those
 * prebuilt binaries instead) — confirmed via `pod install` on a physical
 * iPhone build; no newer package version fixes it. Removed rather than forcing
 * a local Folly podspec, which risks duplicate-symbol link errors against the
 * prebuilt binary. If full-JPEG decode proves too slow on real devices, the
 * right fix is moving this analysis into a VisionCamera Frame Processor
 * (background thread, no JS-thread cost) rather than reintroducing this pod.
 */
export async function analyzeBlur(tempPath: string): Promise<number> {
  const bytes = base64ToBytes(await readBase64(tempPath));
  const { data, width, height } = decodeJpeg(bytes, { useTArray: true });
  return blurScoreFromRgba(data, width, height);
}
