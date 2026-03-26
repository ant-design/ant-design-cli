import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: true,
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire as __createRequire } from "node:module";',
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
  define: {
    __CLI_VERSION__: JSON.stringify(version),
  },
  noExternal: ['commander', '@modelcontextprotocol/sdk'],
});
