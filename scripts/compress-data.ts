#!/usr/bin/env node

/**
 * Compress or decompress data/*.json files.
 *
 * Usage:
 *   npx tsx scripts/compress-data.ts          # compress: .json → .json.gz
 *   npx tsx scripts/compress-data.ts --undo   # decompress: .json.gz → .json
 *
 * Used by npm prepack/postpack hooks to ship .gz in the npm package
 * while keeping .json in the git repository.
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

const dataDir = join(import.meta.dirname, '..', 'data');
const undo = process.argv.includes('--undo');

if (undo) {
  // Decompress: .json.gz → .json
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json.gz'));
  for (const file of files) {
    const gzPath = join(dataDir, file);
    const jsonPath = gzPath.slice(0, -3); // remove .gz
    const content = gunzipSync(readFileSync(gzPath));
    writeFileSync(jsonPath, content);
    unlinkSync(gzPath);
    console.log(`${file} → ${file.slice(0, -3)}`);
  }
  console.log(`\nDecompressed ${files.length} files.`);
} else {
  // Compress: .json → .json.gz
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
}
