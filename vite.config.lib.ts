import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';

function copyDirSync(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: './tsconfig.lib.json',
    }),
    {
      name: 'copy-less-sources',
      closeBundle() {
        copyDirSync(
          path.resolve(__dirname, 'src/styles'),
          path.resolve(__dirname, 'dist/styles'),
        );
      },
    },
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
