#!/usr/bin/env node

/**
 * Compress or decompress data/*.json files.
 *
 * Usage:
 *   npx tsx scripts/compress-data.ts          # compress: create .json.gz alongside .json
 *   npx tsx scripts/compress-data.ts --undo   # clean up: remove .json.gz files
 *
 * Used by npm prepack/postpack hooks to generate .gz files for the npm package.
 * JSON files are kept in git; .gz files are gitignored but included in npm via .npmignore.
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dataDir = join(import.meta.dirname, '..', 'data');
const undo = process.argv.includes('--undo');

if (undo) {
  // Clean up: remove .json.gz files (json files are kept in place)
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json.gz'));
  for (const file of files) {
    unlinkSync(join(dataDir, file));
    console.log(`Removed ${file}`);
  }
  console.log(`\nCleaned up ${files.length} .gz files.`);
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

    const ratio = ((1 - compressed.length / content.length) * 100).toFixed(1);
    console.log(`${file} → ${file}.gz  (${(content.length / 1024 / 1024).toFixed(1)}MB → ${(compressed.length / 1024 / 1024).toFixed(1)}MB, -${ratio}%)`);
  }

  console.log(
    `\nTotal: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB → ${(totalCompressed / 1024 / 1024).toFixed(1)}MB (${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}% reduction)`,
  );
}
