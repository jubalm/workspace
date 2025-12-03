#!/usr/bin/env node

import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  packages: 'external',
  minify: false,
  sourcemap: true,
});

console.log('✓ Build complete');
