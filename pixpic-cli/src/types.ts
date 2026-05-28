// === pixpic-cli: Type Definitions ===

export type EffectType = 'ascii' | 'symbols';
export type ColorMode = 'original' | 'mono' | 'multi';

export type CharsetName = 'standard' | 'shades' | 'dots' | 'steps' | 'numbers' | 'complex' | 'custom';

export interface RenderConfig {
  // Effect
  effect: EffectType;
  charset: CharsetName;
  customCharset: string;
  symbolSetId: string;

  // Appearance
  colorMode: ColorMode;
  monoColor: string;
  palette: string;
  density: number;       // 10-80
  size: number;          // 50-200

  // Canvas
  bgColor: string;       // hex or 'transparent'
  canvasRatio: string;   // 'original' | '1:1' | '4:5' | '3:4' | '9:16' | '16:9'

  // Output
  width: number;         // output width in px (0 = use source)
  height: number;        // output height in px (0 = use source)
}

export interface BatchJob {
  input: string;         // input file path or URL
  output: string;        // output file path
  config: Partial<RenderConfig>;
}

export interface ContentTemplate {
  id: string;
  name: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  tags: string[];
}

export interface ContentPackage {
  date: string;
  postId: string;
  imagePath: string;
  caption: string;
  tags: string[];
  meta: {
    source: string;
    preset: string;
    config: Partial<RenderConfig>;
  };
}

export const DEFAULT_CONFIG: RenderConfig = {
  effect: 'ascii',
  charset: 'standard',
  customCharset: '',
  symbolSetId: 'tech',
  colorMode: 'mono',
  monoColor: '#ffffff',
  palette: 'dream',
  density: 40,
  size: 100,
  bgColor: '#000000',
  canvasRatio: 'original',
  width: 0,
  height: 0,
};
