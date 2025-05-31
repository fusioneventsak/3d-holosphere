import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});