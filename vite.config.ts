import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import themePlugin from 'lovable-tagger';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    themePlugin()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  build: {
    target: 'es2020',
  },
});
