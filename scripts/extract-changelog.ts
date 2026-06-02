/**
 * Extract changelog section for a given version from CHANGELOG.md.
 * Usage: npx tsx scripts/extract-changelog.ts 6.3.4
 */

import fs from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: tsx scripts/extract-changelog.ts <version>');
  process.exit(1);
}

/** Escape all regex special characters in a string so it can be safely embedded in a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const content = fs.readFileSync('CHANGELOG.md', 'utf8');
const regex = new RegExp(
  `^## .*?${escapeRegExp(version)}.*?\n(.*?)(?=^## |(?!\\.))`,
  'ms',
);
const match = regex.exec(content);
if (match) {
  process.stdout.write(match[1].trim() + '\n');
} else {
  process.stdout.write(`Release v${version}\n`);
}
