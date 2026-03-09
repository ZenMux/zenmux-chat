import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    dts({
      tsconfigPath: './tsconfig.lib.json',
    }),
  ],
  resolve: {
    alias: {
      '@kernel': path.resolve(__dirname, 'src/kernel'),
      '@plugins': path.resolve(__dirname, 'src/plugins'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'ai',
        /^@ai-sdk\//,
        'antd',
        /^@ant-design\//,
        '@lobehub/ui',
        /@lobehub\//,
        'react-virtuoso',
        'zod',
        'zustand',
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
