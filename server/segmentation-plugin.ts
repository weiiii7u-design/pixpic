// === Trace — Server-side segmentation API (Vite plugin) ===
// Optimized: sharp downscale before inference, medium model, ONNX session cached.

import type { Plugin } from 'vite';

const MAX_INPUT_DIM = 1024;

export function segmentationPlugin(): Plugin {
  return {
    name: 'trace-segmentation',
    configureServer(server) {
      server.middlewares.use('/api/segment', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        next();
      });

      server.middlewares.use('/api/segment', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) { chunks.push(Buffer.from(chunk)); }
        const imageBuffer = Buffer.concat(chunks);

        if (imageBuffer.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Empty image' }));
          return;
        }

        const url = new URL(req.url || '/', 'http://localhost');
        const cols = parseInt(url.searchParams.get('cols') || '320', 10);
        const rows = parseInt(url.searchParams.get('rows') || '320', 10);

        const t0 = Date.now();
        console.log(`[Trace API] Segmentation: ${(imageBuffer.length / 1024).toFixed(0)}KB → ${cols}x${rows}`);

        try {
          const sharp = (await import('sharp')).default;

          // 1. Downscale input image for faster inference
          const meta = await sharp(imageBuffer).metadata();
          const origW = meta.width || 1024;
          const origH = meta.height || 1024;
          let inputBuffer = imageBuffer;

          if (Math.max(origW, origH) > MAX_INPUT_DIM) {
            const scale = MAX_INPUT_DIM / Math.max(origW, origH);
            inputBuffer = await sharp(imageBuffer)
              .resize(Math.round(origW * scale), Math.round(origH * scale))
              .png()
              .toBuffer();
            console.log(`[Trace API] Downscaled: ${origW}x${origH} → ${Math.round(origW * scale)}x${Math.round(origH * scale)}`);
          }

          // 2. Run segmentation with medium model (fast + good enough)
          const { removeBackground } = await import('@imgly/background-removal-node');
          const imageBlob = new Blob([inputBuffer], { type: 'image/png' });

          const resultBlob = await removeBackground(imageBlob, {
            model: 'medium' as any,  // isnet_fp16 — fast, good quality
            output: { format: 'image/png' as any },
          });

          const arrayBuffer = await resultBlob.arrayBuffer();
          const resultBuffer = Buffer.from(arrayBuffer);

          // 3. Extract alpha at target resolution
          const { data, info } = await sharp(resultBuffer)
            .resize(cols, rows, { fit: 'fill' })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          const mask: boolean[] = [];
          const stride = info.channels;
          for (let i = 0; i < cols * rows; i++) {
            mask.push(data[i * stride + 3] > 128);
          }

          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(`[Trace API] Done in ${elapsed}s: ${mask.filter(Boolean).length}/${mask.length} subject px`);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ mask, cols, rows }));
        } catch (err: any) {
          console.error('[Trace API] Segmentation failed:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Segmentation failed' }));
        }
      });
    },
  };
}
