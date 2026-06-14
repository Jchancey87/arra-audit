import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5050';

export default defineConfig({
  plugins: [react()],
  envDir: '../',
  server: {
    port: 3050,
    host: true,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      '/uploads': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
    allowedHosts: [
      'arra.homma.casa'
     ]
  },
  build: {
    outDir: 'build',
  },
});
