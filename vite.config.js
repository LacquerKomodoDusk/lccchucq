import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> dist/ (обычная сборка)
// `npm run build:single` -> dist-single/index.html (вся игра в одном файле)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
    // sheet textures are small: inline them so the single-file build is self-contained
    assetsInlineLimit: mode === 'single' ? 100000000 : 4096,
  },
}));
