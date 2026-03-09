import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@kernel': path.resolve(__dirname, 'src/kernel'),
      '@plugins': path.resolve(__dirname, 'src/plugins'),
    },
  },
});
