import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  external: ['react', 'react-dom', 'tailwindcss'],
  banner: { js: "'use client';" },
  outDir: 'dist',
});
