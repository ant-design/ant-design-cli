#!/usr/bin/env node

/**
 * Sync antd metadata for all major versions (v4, v5, v6).
 *
 * For each major version:
 *   1. Fetches all release tags from the antd GitHub repo
 *   2. Extracts the latest snapshot as data/v{major}.json
 *   3. Extracts per-minor snapshots (e.g. data/v5.3.2.json) for new minor series
 *   4. Updates data/versions.json with the minor→tag index
 *
 * Usage:
 *   npx tsx scripts/sync.ts --antd-dir antd-source
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAJORS = [4, 5, 6];
const ANTD_REMOTE = 'https://github.com/ant-design/ant-design.git';
const EXTRACT_SCRIPT = path.resolve('scripts/extract.ts');

function parseArgs(args: string[]): { antdDir: string } {
  let antdDir = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--antd-dir' && args[i + 1]) {
      antdDir = path.resolve(args[++i]);
    }
  }
  if (!antdDir) {
    console.error('Usage: tsx scripts/sync.ts --antd-dir <path>');
    process.exit(1);
  }
  return { antdDir };
}

/** Returns all release tags for a major version, sorted ascending by semver. */
function fetchTags(major: number): string[] {
  const out = execSync(
    `git ls-remote --tags --sort=v:refname ${ANTD_REMOTE} "refs/tags/${major}.*"`,
    { encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter((line) => line && !line.includes('^{}'))
    .map((line) => line.replace(/.*refs\/tags\//, ''));
}

/** For each minor series (X.Y), picks the highest patch tag. */
function buildMinorMap(tags: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of tags) {
    const parts = tag.split('.');
    if (parts.length < 3) continue;
    const [major, minor, patch] = parts;
    const minorKey = `${major}.${minor}`;
    const cur = map.get(minorKey);
    if (!cur || parseInt(patch) > parseInt(cur.split('.')[2])) {
      map.set(minorKey, tag);
    }
  }
  return map;
}

function checkout(antdDir: string, tag: string) {
  console.log(`  git checkout ${tag}`);
  execSync(`git checkout ${tag}`, { cwd: antdDir, stdio: 'pipe' });
}

function extract(antdDir: string, output: string) {
  execSync(`npx tsx ${EXTRACT_SCRIPT} --antd-dir ${antdDir} --output ${output}`, {
    stdio: 'inherit',
  });
}

function updateVersionsJson(major: number, minorMap: Map<string, string>) {
  const file = 'data/versions.json';
  const index: Record<string, Record<string, string>> = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : {};
  const majorKey = `v${major}`;
  if (!index[majorKey]) index[majorKey] = {};
  for (const [minorKey, tag] of minorMap) {
    index[majorKey][minorKey] = tag;
  }
  fs.writeFileSync(file, JSON.stringify(index, null, 2) + '\n');
}

function main() {
  const { antdDir } = parseArgs(process.argv.slice(2));

  for (const major of MAJORS) {
    console.log(`\n=== Syncing v${major} ===`);

    const tags = fetchTags(major);
    const latestTag = tags.at(-1);
    if (!latestTag) {
      console.warn(`No tags found for v${major}, skipping`);
      continue;
    }
    console.log(`Latest v${major}: ${latestTag}`);

    const minorMap = buildMinorMap(tags);

    // Extract primary (latest) snapshot → data/v{major}.json
    checkout(antdDir, latestTag);
    extract(antdDir, `data/v${major}.json`);

    // Extract per-minor snapshots, skip ones that already exist
    for (const [minorKey, tag] of minorMap) {
      const snapshot = `data/v${tag}.json`;
      if (fs.existsSync(snapshot)) {
        console.log(`  Snapshot ${snapshot} already exists, skipping`);
        continue;
      }
      console.log(`  Extracting ${minorKey} → ${tag}`);
      checkout(antdDir, tag);
      extract(antdDir, snapshot);
    }

    updateVersionsJson(major, minorMap);
    console.log(`  Updated versions.json for v${major}`);
  }

  console.log('\nSync complete.');
}

main();
