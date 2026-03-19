#!/usr/bin/env node

/**
 * Patch doc/docZh fields into existing snapshot JSON files that are missing them.
 * Reads markdown directly from antd git history using `git show <tag>:...`
 * so a full re-extract is not needed.
 *
 * Usage:
 *   npx tsx scripts/patch-doc-fields.ts --antd-dir ~/Projects/ant-design
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { ComponentData } from '../src/types.js';

function parseArgs(args: string[]): { antdDir: string } {
  let antdDir = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--antd-dir' && args[i + 1]) antdDir = args[++i];
  }
  if (!antdDir) {
    console.error('Usage: tsx scripts/patch-doc-fields.ts --antd-dir <path>');
    process.exit(1);
  }
  antdDir = path.resolve(antdDir);
  if (!fs.existsSync(path.join(antdDir, 'components'))) {
    console.error(`Error: ${antdDir}/components not found.`);
    process.exit(1);
  }
  return { antdDir };
}

/** PascalCase → kebab-case (handles QRCode → qr-code, DatePicker → date-picker) */
function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/** Read a file from git at a specific tag, returns null if not found */
function gitShow(antdDir: string, tag: string, filePath: string): string | null {
  try {
    return execSync(`git show "${tag}:${filePath}"`, {
      cwd: antdDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function main() {
  const { antdDir } = parseArgs(process.argv.slice(2));
  const dataDir = path.resolve('data');

  const jsonFiles = fs
    .readdirSync(dataDir)
    .filter((f) => f.match(/^v\d+\.\d+.*\.json$/) && f !== 'versions.json')
    .map((f) => path.join(dataDir, f));

  console.log(`Found ${jsonFiles.length} snapshot files`);

  let patched = 0;
  let skipped = 0;
  let errors = 0;

  for (const filePath of jsonFiles.sort()) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const store = JSON.parse(raw);

    const components: ComponentData[] = store.components;
    if (!components?.length) continue;

    // Check if already patched (any component has doc field)
    if (components.some((c) => c.doc !== undefined)) {
      skipped++;
      continue;
    }

    const tag = store.version as string;
    console.log(`\n[patch] ${path.basename(filePath)} (tag: ${tag})`);

    let anyPatched = false;
    for (const comp of components) {
      const dirName = toKebabCase(comp.name);
      const enPath = `components/${dirName}/index.en-US.md`;
      const zhPath = `components/${dirName}/index.zh-CN.md`;

      const enRaw = gitShow(antdDir, tag, enPath);
      const zhRaw = gitShow(antdDir, tag, zhPath);

      if (enRaw) {
        comp.doc = matter(enRaw).content || undefined;
        anyPatched = true;
      }
      if (zhRaw) {
        comp.docZh = matter(zhRaw).content || undefined;
      }
    }

    if (anyPatched) {
      fs.writeFileSync(filePath, JSON.stringify(store, null, 2) + '\n');
      console.log(`  → patched ${path.basename(filePath)}`);
      patched++;
    } else {
      console.warn(`  → no docs found (tag ${tag} may not exist in git)`);
      errors++;
    }
  }

  console.log(`\nDone. Patched: ${patched}, Already had doc: ${skipped}, No docs found: ${errors}`);
}

main();
