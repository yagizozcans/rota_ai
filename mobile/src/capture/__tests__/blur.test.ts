import {
  rgbaToGray,
  downscaleGray,
  laplacianVariance,
  blurScoreFromRgba,
  isTooBlurry,
  base64ToBytes,
  type GrayImage,
} from '../blur';
import { config } from '../../config';

function gray(data: number[], width: number, height: number): GrayImage {
  return { data: Uint8Array.from(data), width, height };
}

/** Build an 8×8 checkerboard (sharp) or a uniform field (flat) as grayscale. */
function checkerboard(size: number): GrayImage {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      data[y * size + x] = (x + y) % 2 === 0 ? 0 : 255;
    }
  }
  return { data, width: size, height: size };
}

describe('laplacianVariance', () => {
  test('uniform image has zero variance', () => {
    const flat = gray(new Array(6 * 6).fill(128), 6, 6);
    expect(laplacianVariance(flat)).toBe(0);
  });

  test('sharp checkerboard has high variance; blur discriminates', () => {
    const sharp = laplacianVariance(checkerboard(8));
    const flat = laplacianVariance(gray(new Array(64).fill(100), 8, 8));
    expect(sharp).toBeGreaterThan(flat);
    expect(sharp).toBeGreaterThan(config.BLUR_VARIANCE_MIN);
    expect(flat).toBeLessThan(config.BLUR_VARIANCE_MIN);
  });

  test('tiny images (<3px) return 0 rather than crash', () => {
    expect(laplacianVariance(gray([1, 2, 3, 4], 2, 2))).toBe(0);
  });
});

describe('rgbaToGray', () => {
  test('luminance weighting (pure green is mid-bright, pure blue dim)', () => {
    // 2 px: green then blue.
    const rgba = Uint8Array.from([0, 255, 0, 255, 0, 0, 255, 255]);
    const g = rgbaToGray(rgba, 2, 1);
    expect(g.data[0]).toBe(149); // 255*0.587
    expect(g.data[1]).toBe(29); // 255*0.114
  });
});

describe('downscaleGray', () => {
  test('reduces width to the target and keeps aspect', () => {
    const src = gray(new Array(100 * 50).fill(120), 100, 50);
    const out = downscaleGray(src, 20);
    expect(out.width).toBe(20);
    expect(out.height).toBe(10);
  });
  test('no-op when already at or below target', () => {
    const src = gray([1, 2, 3, 4], 2, 2);
    expect(downscaleGray(src, 640)).toBe(src);
  });
});

describe('blurScoreFromRgba + isTooBlurry', () => {
  test('a flat RGBA frame is flagged too blurry; a sharp one is not', () => {
    const size = 8;
    const flatRgba = new Uint8Array(size * size * 4).fill(120);
    expect(isTooBlurry(blurScoreFromRgba(flatRgba, size, size))).toBe(true);

    // Sharp: checkerboard expanded to RGBA.
    const cb = checkerboard(size);
    const sharpRgba = new Uint8Array(size * size * 4);
    for (let p = 0; p < size * size; p += 1) {
      sharpRgba.set([cb.data[p], cb.data[p], cb.data[p], 255], p * 4);
    }
    expect(isTooBlurry(blurScoreFromRgba(sharpRgba, size, size))).toBe(false);
  });
});

describe('base64ToBytes', () => {
  test('round-trips bytes decoded from base64', () => {
    const original = Uint8Array.from([0, 1, 2, 253, 254, 255]);
    const b64 = Buffer.from(original).toString('base64');
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(original));
  });
});
