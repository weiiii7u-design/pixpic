import { defineConfig } from 'vite';
import { segmentationPlugin } from './server/segmentation-plugin';

export default defineConfig({
  server: { host: true, port: 5174 },
  plugins: [segmentationPlugin()],
  optimizeDeps: {
    exclude: ['@imgly/background-removal']
  }
});
