import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../',
  server: {
    port: 3050,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
    allowedHosts: [
      'sonic-dna.homma.casa'
     ]
  },
  build: {
    outDir: 'build',
  },
});
