#!/usr/bin/env node

/**
 * Bootstrap historical per-minor version snapshots from a local antd checkout.
 *
 * For each minor version series (X.Y), picks the latest patch tag, checks it out,
 * runs extract.ts, and writes data/v{tag}.json. Updates data/versions.json index.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-snapshots.ts --antd-dir ~/Projects/ant-design --major 4
 *   npx tsx scripts/bootstrap-snapshots.ts --antd-dir ~/Projects/ant-design --major 5
 *   npx tsx scripts/bootstrap-snapshots.ts --antd-dir ~/Projects/ant-design --major 6
 *
 * Requirements:
 *   - antd-dir must be a git repository with all tags fetched
 *     (run: git fetch --tags inside the antd directory first)
 *   - Run npm run build in this repo before running this script (for extract.ts deps)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface VersionsIndex {
  [majorKey: string]: { [minorKey: string]: string };
}

function parseArgs(args: string[]): { antdDir: string; major: string } {
  let antdDir = '';
  let major = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--antd-dir' && args[i + 1]) antdDir = args[++i];
    else if (args[i] === '--major' && args[i + 1]) major = args[++i];
  }

  if (!antdDir || !major) {
    console.error('Usage: tsx scripts/bootstrap-snapshots.ts --antd-dir <path> --major <4|5|6>');
    process.exit(1);
  }

  antdDir = path.resolve(antdDir);
  if (!fs.existsSync(path.join(antdDir, 'components'))) {
    console.error(`Error: ${antdDir}/components not found. Is this an antd source directory?`);
    process.exit(1);
  }

  if (!/^\d+$/.test(major)) {
    console.error(`Error: --major must be a number (e.g. 4, 5, 6)`);
    process.exit(1);
  }

  return { antdDir, major };
}

function getAllTags(antdDir: string, major: string): string[] {
  const result = execSync(`git tag --list "${major}.*" --sort=version:refname`, {
    cwd: antdDir,
    encoding: 'utf-8',
  });

  return result
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => /^\d+\.\d+\.\d+$/.test(t)); // only clean semver tags
}

/** For each minor series, pick the tag with the highest patch number. */
function buildMinorMap(tags: string[]): Map<string, string> {
  const map = new Map<string, string>(); // minorKey → bestTag

  for (const tag of tags) {
    const parts = tag.split('.');
    const minorKey = `${parts[0]}.${parts[1]}`;
    const currentBest = map.get(minorKey);
    if (!currentBest) {
      map.set(minorKey, tag);
    } else {
      const curPatch = parseInt(currentBest.split('.')[2], 10);
      const newPatch = parseInt(parts[2], 10);
      if (newPatch > curPatch) {
        map.set(minorKey, tag);
      }
    }
  }

  return map;
}

function checkoutTag(antdDir: string, tag: string): void {
  // -f to overwrite untracked files that would conflict with the tag's tree
  execSync(`git checkout -f "${tag}" --quiet`, { cwd: antdDir, stdio: 'pipe' });
}

function extractSnapshot(antdDir: string, outputPath: string): void {
  execSync(
    `npx tsx scripts/extract.ts --antd-dir "${antdDir}" --output "${outputPath}"`,
    { stdio: 'inherit' },
  );
}

function loadVersionsIndex(indexPath: string): VersionsIndex {
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      // ignore corrupt file
    }
  }
  return {};
}

function saveVersionsIndex(indexPath: string, index: VersionsIndex): void {
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
}

async function main() {
  const { antdDir, major } = parseArgs(process.argv.slice(2));
  const majorKey = `v${major}`;
  const dataDir = path.resolve('data');
  const indexPath = path.join(dataDir, 'versions.json');

  console.log(`\nBootstrapping v${major} historical snapshots from: ${antdDir}`);
  console.log(`Output directory: ${dataDir}\n`);

  // Get all tags
  const allTags = getAllTags(antdDir, major);
  console.log(`Found ${allTags.length} v${major}.x tags`);

  if (allTags.length === 0) {
    console.error(`No tags found for v${major}. Did you run "git fetch --tags" in ${antdDir}?`);
    process.exit(1);
  }

  // Build minor → bestTag map
  const minorMap = buildMinorMap(allTags);
  console.log(`Found ${minorMap.size} minor series:\n`);
  for (const [minorKey, tag] of [...minorMap.entries()].sort()) {
    console.log(`  ${minorKey}.x → ${tag}`);
  }
  console.log('');

  // Load existing index
  const index = loadVersionsIndex(indexPath);
  if (!index[majorKey]) index[majorKey] = {};

  let extracted = 0;
  let skipped = 0;

  for (const [minorKey, tag] of [...minorMap.entries()].sort()) {
    const snapshotPath = path.join(dataDir, `v${tag}.json`);

    if (fs.existsSync(snapshotPath)) {
      console.log(`  [skip] v${tag}.json already exists`);
      index[majorKey][minorKey] = tag;
      skipped++;
      continue;
    }

    console.log(`  [extract] ${minorKey}.x → ${tag}`);
    try {
      checkoutTag(antdDir, tag);
      extractSnapshot(antdDir, snapshotPath);
      index[majorKey][minorKey] = tag;
      extracted++;
      console.log(`  [done] Created data/v${tag}.json`);
    } catch (err) {
      console.error(`  [error] Failed to extract ${tag}:`, (err as Error).message);
      // Continue with remaining tags
    }

    // Save index after each extraction so progress is not lost on failure
    saveVersionsIndex(indexPath, index);
  }

  // Final index save
  saveVersionsIndex(indexPath, index);

  console.log(`\nDone! Extracted ${extracted} new snapshots, skipped ${skipped} existing.`);
  console.log(`Updated data/versions.json with ${Object.keys(index[majorKey]).length} ${majorKey} entries.\n`);
}

main().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
