import { config } from '../config';

/**
 * On-device blur detection (01 §3.5, plan Q2). Pure signal processing — no I/O,
 * no native calls — so it is fully unit-testable. The device glue that turns a
 * captured JPEG into pixels lives in analyzeBlur.ts; this file is only maths.
 *
 * Method: grayscale → downscale to a fixed width (so the threshold is
 * resolution-independent) → Laplacian → variance. A sharp frame has lots of
 * high-frequency edge energy (high variance); a blurred one is smooth (low).
 */

export interface GrayImage {
  data: Uint8Array; // one luminance byte per pixel, row-major
  width: number;
  height: number;
}

/** RGBA (4 bytes/pixel) → luminance (Rec. 601). */
export function rgbaToGray(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < width * height; i += 4, p += 1) {
    data[p] = Math.trunc(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
  }
  return { data, width, height };
}

/** Nearest-neighbour downscale to `targetWidth` (keeps aspect). No-op if already smaller. */
export function downscaleGray(img: GrayImage, targetWidth: number): GrayImage {
  if (img.width <= targetWidth) {
    return img;
  }
  const scale = img.width / targetWidth;
  const width = targetWidth;
  const height = Math.max(1, Math.round(img.height / scale));
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(img.height - 1, Math.trunc(y * scale));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(img.width - 1, Math.trunc(x * scale));
      data[y * width + x] = img.data[sy * img.width + sx];
    }
  }
  return { data, width, height };
}

/** Variance of the Laplacian over the grayscale image (edge energy). */
export function laplacianVariance(img: GrayImage): number {
  const { data, width, height } = img;
  if (width < 3 || height < 3) {
    return 0;
  }
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const c = y * width + x;
      // 4-neighbour Laplacian: up + down + left + right − 4·centre.
      const lap =
        data[c - width] + data[c + width] + data[c - 1] + data[c + 1] - 4 * data[c];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (n === 0) {
    return 0;
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Blur score for an RGBA buffer: the full pipeline (grayscale → 640px → variance). */
export function blurScoreFromRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const gray = downscaleGray(rgbaToGray(rgba, width, height), config.BLUR_ANALYSIS_WIDTH);
  return laplacianVariance(gray);
}

/** Gate: a frame at or below the threshold is too blurry to keep (01 §3.5, Q6). */
export function isTooBlurry(score: number): boolean {
  return score < config.BLUR_VARIANCE_MIN;
}

/** base64 → bytes without Node's Buffer (RN/Hermes provides atob). */
export function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}
