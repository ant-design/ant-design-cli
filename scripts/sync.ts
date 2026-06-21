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

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAJORS = [4, 5, 6];
const ANTD_REMOTE = 'https://github.com/ant-design/ant-design.git';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTRACT_SCRIPT = path.join(__dirname, 'extract.ts');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
// antd ships a hand-curated DESIGN.md (the design-language doc) at its repo root.
// It is major-grained (rewritten only across major releases), so we sync it per
// major into data/design-v{major}.md. See syncDesignDocs().
const DESIGN_SOURCE = 'DESIGN.md';
const BUG_VERSIONS_SOURCE = 'BUG_VERSIONS.json';
const designTarget = (major: number) => path.join(DATA_DIR, `design-v${major}.md`);
const bugVersionsTarget = () => path.join(DATA_DIR, 'bug-versions.json');

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
export function fetchTags(major: number): string[] {
  try {
    const out = execSync(
      `git ls-remote --tags --sort=v:refname ${ANTD_REMOTE} "refs/tags/${major}.*"`,
      { encoding: 'utf8' },
    );
    const tags = out
      .split('\n')
      .filter((line) => line && !line.includes('^{}'))
      .map((line) => line.replace(/.*refs\/tags\//, ''));
    if (tags.length === 0) {
      throw new Error(`No release tags found for v${major}`);
    }
    return tags;
  } catch (err) {
    const stderr = err && typeof err === 'object' && 'stderr' in err && err.stderr
      ? `\n${Buffer.isBuffer(err.stderr) ? err.stderr.toString('utf8') : String(err.stderr)}`
      : '';
    throw new Error(`Error fetching tags for v${major}: ${err instanceof Error ? err.message : err}${stderr}`);
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
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npxCmd, ['tsx', EXTRACT_SCRIPT, '--antd-dir', antdDir, '--output', output], {
    stdio: 'inherit',
  });
}

/**
 * Fetch token-meta.json from the published npm package for the given antd version.
 * This file is a build artifact that doesn't exist in raw git source,
 * so we extract it from `npm pack` and place it where extractors expect it.
 *
 * For v5+, token-meta.json is required — missing it would produce data files
 * with empty tokens, silently breaking the `antd token` command. We throw
 * instead of continuing with empty data.
 */
function fetchTokenMeta(antdDir: string, tag: string) {
  const targetDir = path.join(antdDir, 'components', 'version');
  const targetFile = path.join(targetDir, 'token-meta.json');
  if (fs.existsSync(targetFile)) return;

  const majorVersion = parseInt(tag.split('.')[0], 10);
  const requiresTokens = majorVersion >= 5;

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
        execFileSync('tar', ['-xzf', tarball, p], { cwd: tmpDir, stdio: 'pipe' });
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
      const msg = `token-meta.json not found in antd@${tag}`;
      if (requiresTokens) {
        throw new Error(`${msg} — token data is required for v5+ and cannot be empty`);
      }
      console.log(`  ${msg}, tokens will be empty (v4/v3)`);
    }
  } catch (err) {
    if (requiresTokens) {
      throw err; // Re-throw for v5+ — don't silently produce empty token data
    }
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

/** Validate that primary data files are well-formed after sync. */
function validateData() {
  let errors = 0;
  for (const major of MAJORS) {
    const file = path.join(DATA_DIR, `v${major}.json`);
    if (!fs.existsSync(file)) {
      console.error(`  FAIL: ${file} does not exist`);
      errors++;
      continue;
    }
    let data: any;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`  FAIL: ${file} is not valid JSON: ${err instanceof Error ? err.message : err}`);
      errors++;
      continue;
    }
    if (!data.version || typeof data.version !== 'string') {
      console.error(`  FAIL: ${file} missing or invalid "version" field`);
      errors++;
    }
    if (!data.majorVersion || typeof data.majorVersion !== 'string') {
      console.error(`  FAIL: ${file} missing or invalid "majorVersion" field`);
      errors++;
    }
    if (!Array.isArray(data.components) || data.components.length === 0) {
      console.error(`  FAIL: ${file} missing or empty "components" array`);
      errors++;
    }
  }

  const bugVersionsFile = bugVersionsTarget();
  try {
    const data = JSON.parse(fs.readFileSync(bugVersionsFile, 'utf8')) as Record<string, unknown>;
    if (Object.keys(data).length === 0) {
      console.error(`  FAIL: ${bugVersionsFile} is empty`);
      errors++;
    }
    for (const [range, urls] of Object.entries(data)) {
      if (!Array.isArray(urls) || urls.some((url) => typeof url !== 'string')) {
        console.error(`  FAIL: ${bugVersionsFile} has invalid URLs for range "${range}"`);
        errors++;
      }
    }
  } catch (err) {
    console.error(`  FAIL: ${bugVersionsFile} is not valid JSON: ${err instanceof Error ? err.message : err}`);
    errors++;
  }

  if (errors > 0) {
    console.error(`\nValidation failed with ${errors} error(s)`);
    process.exit(1);
  }
  console.log('  All data files valid');
}

/**
 * Sync per-major design.md files from the antd source checkout.
 *
 * antd keeps a hand-curated DESIGN.md at its repo root (the design-language
 * document described in ant-design/ant-design#58011). It is not version-specific
 * data we can extract — we just copy it verbatim, like other bundled assets.
 *
 * The doc is major-grained (rewritten only across major releases), so for each
 * major we check out its latest tag and copy DESIGN.md → data/design-v{major}.md.
 * We check out explicitly because the loop may have skipped checkout when already
 * up-to-date, and the CI clone uses --no-checkout. If the source file is absent
 * (e.g. a major that predates DESIGN.md, or not yet released in that tag), we keep
 * any existing data/design-v{major}.md rather than deleting it — so an already
 * bundled copy survives until upstream publishes the file.
 */
function syncDesignDocs(antdDir: string, latestTagByMajor: Map<number, string>) {
  for (const major of MAJORS) {
    const tag = latestTagByMajor.get(major);
    if (!tag) {
      console.log(`  v${major}: no latest tag, keeping existing data/design-v${major}.md`);
      continue;
    }
    if (!checkout(antdDir, tag)) {
      console.log(`  v${major}: could not check out ${tag}, keeping existing data/design-v${major}.md`);
      continue;
    }
    const source = path.join(antdDir, DESIGN_SOURCE);
    if (!fs.existsSync(source)) {
      console.log(`  v${major}: ${DESIGN_SOURCE} not found in antd@${tag}, keeping existing data/design-v${major}.md`);
      continue;
    }
    fs.copyFileSync(source, designTarget(major));
    console.log(`  v${major}: synced ${DESIGN_SOURCE} from antd@${tag} → data/design-v${major}.md`);
  }
}

/**
 * Sync the root BUG_VERSIONS.json from the latest stable antd checkout.
 *
 * This file powers `antd doctor`'s known-bug version check. Keeping it in the
 * normal sync pipeline preserves the CLI's offline runtime behavior without
 * letting the bundled bug database drift from upstream.
 */
function syncBugVersions(antdDir: string, latestTagByMajor: Map<number, string>) {
  const latestMajor = Math.max(...latestTagByMajor.keys());
  const tag = latestTagByMajor.get(latestMajor);
  if (!tag) {
    console.log(`  no latest tag, keeping existing data/bug-versions.json`);
    return;
  }
  if (!checkout(antdDir, tag)) {
    console.log(`  could not check out ${tag}, keeping existing data/bug-versions.json`);
    return;
  }

  const source = path.join(antdDir, BUG_VERSIONS_SOURCE);
  if (!fs.existsSync(source)) {
    console.log(`  ${BUG_VERSIONS_SOURCE} not found in antd@${tag}, keeping existing data/bug-versions.json`);
    return;
  }

  fs.copyFileSync(source, bugVersionsTarget());
  console.log(`  synced ${BUG_VERSIONS_SOURCE} from antd@${tag} → data/bug-versions.json`);
}

function main() {
  const { antdDir } = parseArgs(process.argv.slice(2));

  // Track the latest stable tag per major, so we can sync version-independent
  // assets (DESIGN.md) from the newest major's checkout after the loop.
  const latestTagByMajor = new Map<number, string>();

  for (const major of MAJORS) {
    console.log(`\n=== Syncing v${major} ===`);

    const tags = fetchTags(major);
    const minorMap = buildMinorMap(tags); // pre-releases already excluded
    const latestTag = [...minorMap.values()].at(-1);
    if (!latestTag) {
      console.warn(`No stable tags found for v${major}, skipping`);
      continue;
    }
    latestTagByMajor.set(major, latestTag);
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
      try {
        fetchTokenMeta(antdDir, latestTag);
      } catch (err) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
        console.error(`  Skipping v${major} primary extract — cannot proceed without token data`);
        continue;
      }
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
      try {
        fetchTokenMeta(antdDir, tag);
      } catch (err) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
        console.error(`  Skipping ${minorKey} snapshot — cannot proceed without token data`);
        continue;
      }
      extract(antdDir, snapshot);
    }

    updateVersionsJson(major, minorMap);
    console.log(`  Updated versions.json for v${major}`);
  }

  // Final sweep: remove any snapshot files not referenced by versions.json
  console.log('\n=== Cleaning stale snapshots ===');
  cleanStaleSnapshots();

  // Sync per-major design.md files (DESIGN.md) from each major's latest checkout.
  console.log('\n=== Syncing design.md ===');
  syncDesignDocs(antdDir, latestTagByMajor);

  // Sync known-bug version data from latest stable antd.
  console.log('\n=== Syncing BUG_VERSIONS.json ===');
  syncBugVersions(antdDir, latestTagByMajor);

  // Validate extracted data
  console.log('\n=== Validating extracted data ===');
  validateData();

  console.log('\nSync complete.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
