import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'frontend',
  publicDir: '../assets',
  plugins: [react()],
  build: {
    outDir: '../dist/react',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
});
