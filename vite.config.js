import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5321,
    proxy: {
      '/api': 'http://localhost:5320',
      '/ping': 'http://localhost:5320',
      '/badge': 'http://localhost:5320',
      '/status': 'http://localhost:5320'
    }
  }
});
