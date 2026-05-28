// === pixpic-cli: Main Render Pipeline ===

import type { Canvas } from '@napi-rs/canvas';
import type { RenderConfig } from './types.js';
import { loadImage, saveCanvas } from './image-loader.js';
import { renderAscii } from './effects/ascii.js';
import { renderSymbols } from './effects/symbols.js';
import { DEFAULT_CONFIG } from './types.js';

/**
 * Render a single image with given config
 */
export async function render(
  inputPath: string,
  outputPath: string,
  partialConfig: Partial<RenderConfig> = {}
): Promise<void> {
  const config: RenderConfig = { ...DEFAULT_CONFIG, ...partialConfig };

  // Load source image
  const { canvas: sourceCanvas, width, height } = await loadImage(inputPath);

  // Set output dimensions if not specified
  if (!config.width) config.width = width;
  if (!config.height) config.height = height;

  // Apply effect
  let output: Canvas;
  if (config.effect === 'symbols') {
    output = renderSymbols(sourceCanvas, config);
  } else {
    output = renderAscii(sourceCanvas, config);
  }

  // Save output
  await saveCanvas(output, outputPath);
  console.log(`✓ ${outputPath}`);
}

/**
 * Batch render: one image × multiple presets
 */
export async function batchRender(
  inputPath: string,
  presets: Record<string, Partial<RenderConfig>>,
  outputDir: string
): Promise<string[]> {
  const results: string[] = [];
  const baseName = inputPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'output';

  for (const [presetName, config] of Object.entries(presets)) {
    const outputPath = `${outputDir}/${baseName}_${presetName}.png`;
    await render(inputPath, outputPath, config);
    results.push(outputPath);
  }

  return results;
}
