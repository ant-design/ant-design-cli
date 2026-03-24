#!/usr/bin/env node

/**
 * Compress all data/*.json files to data/*.json.gz using gzip.
 * Skips versions.json (kept as plain JSON for easy reading).
 *
 * Usage:
 *   npx tsx scripts/compress-data.ts
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dataDir = join(import.meta.dirname, '..', 'data');
const files = readdirSync(dataDir).filter(
  (f) => f.endsWith('.json') && f !== 'versions.json',
);

let totalOriginal = 0;
let totalCompressed = 0;

for (const file of files) {
  const filePath = join(dataDir, file);
  const content = readFileSync(filePath);
  const compressed = gzipSync(content, { level: 9 });

  totalOriginal += content.length;
  totalCompressed += compressed.length;

  writeFileSync(filePath + '.gz', compressed);
  unlinkSync(filePath);

  const ratio = ((1 - compressed.length / content.length) * 100).toFixed(1);
  console.log(`${file} → ${file}.gz  (${(content.length / 1024 / 1024).toFixed(1)}MB → ${(compressed.length / 1024 / 1024).toFixed(1)}MB, -${ratio}%)`);
}

console.log(
  `\nTotal: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB → ${(totalCompressed / 1024 / 1024).toFixed(1)}MB (${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}% reduction)`,
);
