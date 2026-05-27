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
import { fileURLToPath } from 'node:url';

const MAJORS = [4, 5, 6];
const ANTD_REMOTE = 'https://github.com/ant-design/ant-design.git';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTRACT_SCRIPT = path.join(__dirname, 'extract.ts');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

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
  // Verify we're running from the project root
  if (!fs.existsSync(path.join(PROJECT_ROOT, 'package.json'))) {
    console.error(`Error: Cannot find package.json in ${PROJECT_ROOT}. Run this script from the project root.`);
    process.exit(1);
  }
  return { antdDir };
}

/** Returns all release tags for a major version, sorted ascending by semver. */
function fetchTags(major: number): string[] {
  try {
    const out = execSync(
      `git ls-remote --tags --sort=v:refname ${ANTD_REMOTE} "refs/tags/${major}.*"`,
      { encoding: 'utf8' },
    );
    return out
      .split('\n')
      .filter((line) => line && !line.includes('^{}'))
      .map((line) => line.replace(/.*refs\/tags\//, ''));
  } catch (err) {
    console.error(`Error fetching tags for v${major}: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

/** For each minor series (X.Y), picks the highest patch tag. Excludes pre-releases (e.g. 5.0.0-rc.1). */
function buildMinorMap(tags: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of tags) {
    if (tag.includes('-')) continue; // skip pre-releases
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

function checkout(antdDir: string, tag: string): boolean {
  console.log(`  git checkout ${tag}`);
  try {
    execSync(`git checkout ${tag}`, { cwd: antdDir, stdio: 'pipe' });
    return true;
  } catch (err) {
    console.error(`  Error checking out ${tag}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

function extract(antdDir: string, output: string) {
  execSync(`npx tsx ${EXTRACT_SCRIPT} --antd-dir ${antdDir} --output ${output}`, {
    stdio: 'inherit',
  });
}

/**
 * Fetch token-meta.json from the published npm package for the given antd version.
 * This file is a build artifact that doesn't exist in raw git source,
 * so we extract it from `npm pack` and place it where extractors expect it.
 */
function fetchTokenMeta(antdDir: string, tag: string) {
  const targetDir = path.join(antdDir, 'components', 'version');
  const targetFile = path.join(targetDir, 'token-meta.json');
  if (fs.existsSync(targetFile)) return;

  const tmpDir = path.join(antdDir, '.tmp-npm-pack');
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    console.log(`  Fetching token-meta.json from antd@${tag}...`);
    execSync(`npm pack antd@${tag} --quiet 2>/dev/null`, { cwd: tmpDir, stdio: 'pipe' });
    const tarball = fs.readdirSync(tmpDir).find((f) => f.endsWith('.tgz'));
    if (!tarball) throw new Error('tarball not found');
    // Try package/es/version/ (v5+) first, then package/lib/version/ (v4)
    const paths = [
      'package/es/version/token-meta.json',
      'package/lib/version/token-meta.json',
    ];
    let extracted = false;
    for (const p of paths) {
      try {
        execSync(`tar -xzf ${tarball} ${p}`, { cwd: tmpDir, stdio: 'pipe' });
        const extractedPath = path.join(tmpDir, p);
        if (fs.existsSync(extractedPath)) {
          fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(extractedPath, targetFile);
          extracted = true;
          break;
        }
      } catch {
        // This path may not exist in this version's package
      }
    }
    if (!extracted) {
      console.log(`  token-meta.json not found in antd@${tag}, tokens will be empty`);
    }
  } catch (err) {
    console.warn(`  Warning: Failed to fetch token-meta.json for antd@${tag}: ${err instanceof Error ? err.message : err}`);
  } finally {
    // Clean up temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

function updateVersionsJson(major: number, minorMap: Map<string, string>) {
  const file = path.join(DATA_DIR, 'versions.json');
  let index: Record<string, Record<string, string>> = {};
  try {
    if (fs.existsSync(file)) {
      index = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    // If versions.json is corrupted, DON'T overwrite it — that would lose data for
    // majors not in our loop (e.g. v3). Just update this major's key in an empty object.
    console.error(`  Warning: Failed to parse versions.json, data for other majors may be lost: ${err instanceof Error ? err.message : err}`);
  }
  const majorKey = `v${major}`;
  if (!index[majorKey]) index[majorKey] = {};
  for (const [minorKey, tag] of minorMap) {
    index[majorKey][minorKey] = tag;
  }
  // Atomic write: write to temp file in same directory then rename (avoids EXDEV across filesystems)
  const tmpFile = path.join(DATA_DIR, `.versions-${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(index, null, 2) + '\n');
    fs.renameSync(tmpFile, file);
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    throw err;
  }
}

/** Remove snapshot files no longer referenced by versions.json. */
function cleanStaleSnapshots() {
  const versionsFile = path.join(DATA_DIR, 'versions.json');
  let index: Record<string, Record<string, string>>;
  try {
    index = JSON.parse(fs.readFileSync(versionsFile, 'utf8'));
  } catch (err) {
    console.error(`  Warning: Failed to parse versions.json, skipping stale snapshot cleanup: ${err instanceof Error ? err.message : err}`);
    return;
  }

  if (Object.keys(index).length === 0) {
    console.warn('  versions.json is empty, skipping stale snapshot cleanup');
    return;
  }

  // Collect all referenced snapshot filenames (e.g. "v6.3.7.json")
  const referenced = new Set<string>();
  for (const [majorKey, minorIndex] of Object.entries(index)) {
    referenced.add(`${majorKey}.json`); // primary snapshot (e.g. v6.json)
    for (const tag of Object.values(minorIndex ?? {})) {
      referenced.add(`v${tag}.json`);
    }
  }

  // Scan data/ for stale .json files matching the v{X}.{Y}.{Z}.json pattern
  const files = fs.readdirSync(DATA_DIR).filter((f) => /^v\d+\.\d+\.\d+\.json$/.test(f));
  let removed = 0;
  for (const file of files) {
    if (!referenced.has(file)) {
      fs.unlinkSync(path.join(DATA_DIR, file));
      console.log(`  Removed stale snapshot: data/${file}`);
      removed++;
    }
  }
  if (removed === 0) {
    console.log('  No stale snapshots to remove');
  }
}

function main() {
  const { antdDir } = parseArgs(process.argv.slice(2));

  for (const major of MAJORS) {
    console.log(`\n=== Syncing v${major} ===`);

    const tags = fetchTags(major);
    if (tags.length === 0) {
      console.warn(`No tags fetched for v${major}, skipping`);
      continue;
    }
    const minorMap = buildMinorMap(tags); // pre-releases already excluded
    const latestTag = [...minorMap.values()].at(-1);
    if (!latestTag) {
      console.warn(`No stable tags found for v${major}, skipping`);
      continue;
    }
    console.log(`Latest v${major}: ${latestTag}`);

    // Extract primary (latest) snapshot → data/v{major}.json (skip if already up-to-date)
    const primaryFile = path.join(DATA_DIR, `v${major}.json`);
    const currentVersion = fs.existsSync(primaryFile)
      ? JSON.parse(fs.readFileSync(primaryFile, 'utf8')).version
      : null;
    if (currentVersion === latestTag) {
      console.log(`  v${major} already at ${latestTag}, skipping primary extract`);
    } else {
      console.log(`  v${major}: ${currentVersion} → ${latestTag}`);
      if (!checkout(antdDir, latestTag)) continue;
      fetchTokenMeta(antdDir, latestTag);
      extract(antdDir, primaryFile);
    }

    // Extract per-minor snapshots, replacing stale ones whose patch version changed
    for (const [minorKey, tag] of minorMap) {
      const snapshot = path.join(DATA_DIR, `v${tag}.json`);
      if (fs.existsSync(snapshot)) {
        console.log(`  Snapshot v${tag}.json already exists, skipping`);
        continue;
      }
      // Remove stale snapshot for this minor (e.g. v6.4.2.json when tag is now 6.4.3)
      const stalePattern = new RegExp(`^v${minorKey.replaceAll('.', '\\.')}\\.\\d+\\.json$`);
      const staleFiles = fs.readdirSync(DATA_DIR).filter((f) => stalePattern.test(f));
      for (const stale of staleFiles) {
        fs.unlinkSync(path.join(DATA_DIR, stale));
        console.log(`  Removed stale snapshot: data/${stale}`);
      }
      console.log(`  Extracting ${minorKey} → ${tag}`);
      if (!checkout(antdDir, tag)) {
        console.warn(`  Skipping ${minorKey} due to checkout failure`);
        continue;
      }
      fetchTokenMeta(antdDir, tag);
      extract(antdDir, snapshot);
    }

    updateVersionsJson(major, minorMap);
    console.log(`  Updated versions.json for v${major}`);
  }

  // Final sweep: remove any snapshot files not referenced by versions.json
  console.log('\n=== Cleaning stale snapshots ===');
  cleanStaleSnapshots();

  console.log('\nSync complete.');
}

main();
