// === pixpic-cli: Main CLI Entry ===

import { Command } from 'commander';
import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { render, batchRender } from './render.js';
import { generateContentPackage } from './content.js';
import type { RenderConfig } from './types.js';

const program = new Command();

program
  .name('pixpic-cli')
  .description('Headless renderer for pixpic - batch ASCII/symbol art generation')
  .version('1.0.0');

// === Render Command ===
program
  .command('render')
  .description('Render a single image with ASCII/symbol art')
  .requiredOption('-i, --input <path>', 'Input image path or URL')
  .requiredOption('-o, --output <path>', 'Output PNG path')
  .option('--effect <type>', 'Effect type: ascii | symbols', 'ascii')
  .option('--charset <name>', 'Charset: standard|complex|custom|...', 'standard')
  .option('--custom-text <text>', 'Custom text for charset=custom')
  .option('--symbol-set <id>', 'Symbol set: tech|nature|minimal|geo|stars', 'tech')
  .option('--color-mode <mode>', 'Color: original|mono|multi', 'mono')
  .option('--mono-color <hex>', 'Mono color', '#ffffff')
  .option('--density <n>', 'Density (10-80)', '40')
  .option('--size <n>', 'Font size % (50-200)', '100')
  .option('--bg <hex>', 'Background color', '#000000')
  .option('--width <n>', 'Output width (0=source)', '0')
  .option('--height <n>', 'Output height (0=source)', '0')
  .action(async (opts) => {
    const config: Partial<RenderConfig> = {
      effect: opts.effect,
      charset: opts.charset,
      customCharset: opts.customText || '',
      symbolSetId: opts.symbolSet,
      colorMode: opts.colorMode,
      monoColor: opts.monoColor,
      density: parseInt(opts.density),
      size: parseInt(opts.size),
      bgColor: opts.bg,
      width: parseInt(opts.width),
      height: parseInt(opts.height),
    };
    await render(opts.input, opts.output, config);
  });

// === Batch Command ===
program
  .command('batch')
  .description('Batch render: apply all presets to input image(s)')
  .requiredOption('-i, --input <path>', 'Input image or directory')
  .option('-p, --presets <dir>', 'Presets directory', './presets')
  .option('-o, --output <dir>', 'Output directory', './output')
  .action(async (opts) => {
    const presetsDir = resolve(opts.presets);
    const outputDir = resolve(opts.output);
    mkdirSync(outputDir, { recursive: true });

    // Load presets
    const presetFiles = readdirSync(presetsDir).filter(f => f.endsWith('.json'));
    const presets: Record<string, Partial<RenderConfig>> = {};
    for (const file of presetFiles) {
      const name = file.replace('.json', '');
      presets[name] = JSON.parse(readFileSync(join(presetsDir, file), 'utf-8'));
    }

    console.log(`Loaded ${Object.keys(presets).length} presets`);

    // Determine input files
    const inputPath = resolve(opts.input);
    const { statSync } = await import('fs');
    let inputFiles: string[];

    if (statSync(inputPath).isDirectory()) {
      inputFiles = readdirSync(inputPath)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => join(inputPath, f));
    } else {
      inputFiles = [inputPath];
    }

    console.log(`Processing ${inputFiles.length} image(s) × ${Object.keys(presets).length} presets`);

    for (const file of inputFiles) {
      await batchRender(file, presets, outputDir);
    }

    console.log(`\n✅ Done! Output: ${outputDir}`);
  });

// === Content Command ===
program
  .command('content')
  .description('Generate full content packages (image + caption + tags)')
  .requiredOption('-i, --input <path>', 'Input image or directory')
  .option('-p, --presets <dir>', 'Presets directory', './presets')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-t, --template <id>', 'Template: effect-showcase|tutorial|emotion|comparison', 'effect-showcase')
  .action(async (opts) => {
    const presetsDir = resolve(opts.presets);
    const outputDir = resolve(opts.output);
    mkdirSync(outputDir, { recursive: true });

    // Load presets
    const presetFiles = readdirSync(presetsDir).filter(f => f.endsWith('.json'));
    const presets: Record<string, Partial<RenderConfig>> = {};
    for (const file of presetFiles) {
      const name = file.replace('.json', '');
      presets[name] = JSON.parse(readFileSync(join(presetsDir, file), 'utf-8'));
    }

    // Render + generate captions
    const inputPath = resolve(opts.input);
    const { statSync } = await import('fs');
    let inputFiles: string[];

    if (statSync(inputPath).isDirectory()) {
      inputFiles = readdirSync(inputPath)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => join(inputPath, f));
    } else {
      inputFiles = [inputPath];
    }

    for (const file of inputFiles) {
      for (const [presetName, config] of Object.entries(presets)) {
        const postDir = join(outputDir, `${new Date().toISOString().slice(0, 10)}_${presetName}`);
        mkdirSync(postDir, { recursive: true });

        const outputPath = join(postDir, 'cover.png');
        await render(file, outputPath, config);

        generateContentPackage(file, presetName, config, opts.template, outputDir);
      }
    }

    console.log(`\n✅ Content packages generated: ${outputDir}`);
  });

program.parse();
