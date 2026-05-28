// === pixpic-cli: Content Generator (Template + Caption) ===

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { RenderConfig, ContentPackage } from './types.js';

interface TemplateVars {
  style_name: string;
  custom_text: string;
  density: number;
  palette: string;
  color: string;
  effect: string;
}

// === Content Templates ===

const TEMPLATES = {
  'effect-showcase': {
    titles: [
      '用一句话画你的照片，我输入了"{{custom_text}}"',
      '把文字变成照片的画笔，效果绝了',
      '这个免费工具让我的照片全是字',
    ],
    hooks: [
      '发现一个超酷的网页工具\n可以把任何文字变成照片的"画笔"\n远看是照片，近看全是字 💭',
      '不需要下载app\n手机浏览器打开就能用\n效果好到我自己都惊了',
    ],
    ctas: [
      '试试输入你想说的话 ↓\n工具链接放评论区',
      '你想用什么文字试试？评论区告诉我👇',
    ],
    tags: ['#字符画', '#创意修图', '#文字修图', '#照片变字', '#修图教程', '#免费工具'],
  },
  'tutorial': {
    titles: [
      '3步把照片变成字符画｜免费网页工具',
      '手机修图新玩法｜照片秒变ASCII艺术',
      '教你用文字画照片｜参数全分享',
    ],
    hooks: [
      '不用下载app，手机浏览器直接打开就能用👇\n步骤超简单：',
      '最近发现的宝藏修图工具\n三步出片，参数分享给你们👇',
    ],
    ctas: [
      '链接在评论区\niPhone可以添加到主屏幕当app用',
      '保存这条笔记下次用\n有问题评论区问我',
    ],
    tags: ['#修图教程', '#字符画', '#免费修图工具', '#手机修图', '#创意摄影', '#小红书修图'],
  },
  'emotion': {
    titles: [
      '把他的名字藏进合照里，他还没发现',
      '用"{{custom_text}}"画了一张照片送给你',
      '整张照片都是我想对你说的话',
    ],
    hooks: [
      '远看是一张普通照片\n放大看全是他的名字\n发给他看看能不能发现 😏',
      '有些话说不出口\n就让它藏在照片里吧\n凑近了才能看到',
    ],
    ctas: [
      '你想用谁的名字试试？\n工具链接评论区见',
      '送给你喜欢的人吧 💭\n评论区告诉我你想输入什么',
    ],
    tags: ['#情侣日常', '#创意礼物', '#修图', '#隐藏彩蛋', '#字符画', '#表白神器'],
  },
  'comparison': {
    titles: [
      '同一张照片，7种字符画风格你pick哪个',
      '一张照片7种玩法，你最喜欢哪种？',
      '字符画风格大赏｜评论区选你最爱的',
    ],
    hooks: [
      '一张照片7种玩法👆\n每种风格都不一样\n你最喜欢哪种效果？',
      '把同一张照片做了7种字符风格\n从极简到复杂都有\n选一个评论区告诉我👇',
    ],
    ctas: [
      '评论区告诉我你pick哪个\n下次出教程👇',
      '哪个最好看？\n想学哪个扣对应数字',
    ],
    tags: ['#字符画', '#点阵风', '#ASCII艺术', '#修图对比', '#创意修图', '#风格对比'],
  },
};

// Style name mapping
const STYLE_NAMES: Record<string, string> = {
  standard: '标准 ASCII',
  complex: '复杂字符',
  custom: '自定义文字',
  tech: '科技符号 ✦+○×',
  nature: '自然花朵 ✿❀',
  minimal: '极简点 · •',
  geo: '几何图形 △□◇',
  stars: '星辰 ✦✧★',
};

const PALETTE_NAMES: Record<string, string> = {
  dream: '千禧梦境',
  happy: '开心五彩',
  nature: '自然色系',
  neon: '亚比荧光',
  photo: '原图选色',
};

/**
 * Generate caption for a rendered image
 */
export function generateCaption(
  templateId: keyof typeof TEMPLATES,
  config: Partial<RenderConfig>
): { title: string; body: string; tags: string[] } {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`Template "${templateId}" not found`);

  const vars: TemplateVars = {
    style_name: config.charset === 'custom'
      ? `自定义"${config.customCharset}"`
      : STYLE_NAMES[config.charset || config.symbolSetId || 'standard'] || '标准',
    custom_text: config.customCharset || '想你',
    density: config.density || 40,
    palette: PALETTE_NAMES[config.palette || 'dream'] || '千禧梦境',
    color: config.monoColor || '#ffffff',
    effect: config.effect === 'symbols' ? '符号' : '字符',
  };

  // Pick random from arrays
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  let title = pick(template.titles);
  let hook = pick(template.hooks);
  const cta = pick(template.ctas);

  // Replace template vars
  const replaceVars = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars as any)[key] || '');

  title = replaceVars(title);
  hook = replaceVars(hook);

  // Build body
  const paramSection = `\n参数分享：\n📌 点样：${vars.style_name}\n📌 密度：${vars.density}\n📌 色板：${vars.palette}`;
  const body = `${hook}\n${paramSection}\n\n${cta}`;

  return { title, body, tags: template.tags };
}

/**
 * Generate a full content package
 */
export function generateContentPackage(
  imagePath: string,
  presetName: string,
  config: Partial<RenderConfig>,
  templateId: keyof typeof TEMPLATES,
  outputDir: string
): ContentPackage {
  const { title, body, tags } = generateCaption(templateId, config);
  const date = new Date().toISOString().slice(0, 10);
  const postId = `${date}_${presetName}`;

  // Create post directory
  const postDir = join(outputDir, postId);
  mkdirSync(postDir, { recursive: true });

  // Write caption
  const caption = `${title}\n\n${body}\n\n${tags.join(' ')}`;
  writeFileSync(join(postDir, 'caption.txt'), caption, 'utf-8');

  // Write meta
  const meta = { source: imagePath, preset: presetName, config };
  writeFileSync(join(postDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  return { date, postId, imagePath, caption, tags, meta };
}
