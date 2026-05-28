// === pixpic-cli: Image Loader (sharp + @napi-rs/canvas) ===

import sharp from 'sharp';
import { createCanvas, type Canvas } from '@napi-rs/canvas';

export interface LoadedImage {
  width: number;
  height: number;
  canvas: Canvas;
}

/**
 * Load an image from file path or URL into a Canvas
 */
export async function loadImage(source: string): Promise<LoadedImage> {
  let buffer: Buffer;

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source);
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    buffer = await sharp(source).toBuffer();
  }

  const metadata = await sharp(buffer).metadata();
  const { width = 800, height = 600 } = metadata;

  // Decode to raw RGBA pixels
  const rawBuffer = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Create canvas and draw pixels
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  Buffer.from(rawBuffer).copy(Buffer.from(imageData.data));
  ctx.putImageData(imageData, 0, 0);

  return { width, height, canvas };
}

/**
 * Save a canvas to PNG file
 */
export async function saveCanvas(canvas: Canvas, outputPath: string): Promise<void> {
  const pngData = canvas.toBuffer('image/png');
  await sharp(pngData).png().toFile(outputPath);
}
