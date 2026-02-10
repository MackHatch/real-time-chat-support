import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/embeds/widget-loader.ts'),
      name: 'SupportWidget',
      fileName: 'widget',
      formats: ['iife'],
    },
    outDir: 'dist/widget',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'widget.js',
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
      },
    },
  },
});
