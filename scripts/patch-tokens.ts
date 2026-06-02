#!/usr/bin/env node
/**
 * Patch missing token data (globalTokens + component.tokens) in snapshot JSON files.
 *
 * The sync pipeline sometimes produces files without token data when fetchTokenMeta
 * silently fails. This script re-downloads token-meta.json from npm and injects
 * the missing tokens into existing files.
 *
 * Only patches files that are missing globalTokens — files with existing token data
 * are left untouched.
 *
 * Usage:
 *   npx tsx scripts/patch-tokens.ts          # patch all v5+ files missing tokens
 *   npx tsx scripts/patch-tokens.ts --dry-run # show what would be patched
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import type { TokenData } from '../src/types.js';

const dataDir = path.resolve('data');
const tmpBase = path.join(os.tmpdir(), 'antd-patch-tokens');

// --- Token extraction logic (mirrors extractors/tokens.ts) ---

interface TokenMetaEntry {
  source: string;
  token: string;
  type: string;
  desc: string;
  descEn: string;
  name: string;
  nameEn: string;
}

interface TokenMetaFile {
  global: Record<string, TokenMetaEntry[]>;
  components: Record<string, TokenMetaEntry[]>;
}

function toTokenData(entry: TokenMetaEntry): TokenData {
  return {
    name: entry.token,
    type: entry.type,
    default: '',
    description: entry.descEn || entry.nameEn || '',
    descriptionZh: entry.desc || entry.name || '',
  };
}

function extractGlobalTokens(meta: TokenMetaFile): TokenData[] {
  const tokens: TokenData[] = [];
  for (const [tokenName, entries] of Object.entries(meta.global)) {
    for (const entry of (Array.isArray(entries) ? entries : [entries])) {
      const data = toTokenData(entry);
      if (!data.name) data.name = tokenName;
      tokens.push(data);
    }
  }
  return tokens;
}

function extractComponentTokens(meta: TokenMetaFile, componentName: string): TokenData[] {
  const entries = meta.components[componentName];
  if (!entries) return [];
  return entries.map(toTokenData);
}

// --- npm pack logic (mirrors patch-token-names.ts) ---

function fetchTokenMeta(version: string): TokenMetaFile | null {
  const tmpDir = path.join(tmpBase, version);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const metaPath = path.join(tmpDir, 'token-meta.json');
  if (fs.existsSync(metaPath)) {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  }

  console.log(`  Downloading antd@${version}...`);
  try {
    execFileSync('npm', ['pack', `antd@${version}`, '--quiet'], { cwd: tmpDir, stdio: 'pipe' });
    const tarball = fs.readdirSync(tmpDir).find((f) => f.endsWith('.tgz'));
    if (!tarball) throw new Error('tarball not found');
    execFileSync('tar', ['-xzf', tarball, 'package/es/version/token-meta.json'], {
      cwd: tmpDir,
      stdio: 'pipe',
    });
    const extracted = path.join(tmpDir, 'package', 'es', 'version', 'token-meta.json');
    if (!fs.existsSync(extracted)) throw new Error('token-meta.json not found in package');
    const raw = fs.readFileSync(extracted, 'utf-8');
    fs.writeFileSync(metaPath, raw);
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`  Warning: could not fetch antd@${version}: ${(e as Error).message}`);
    return null;
  }
}

// --- Main ---

interface SnapshotInfo {
  file: string;
  version: string;
  missingGlobalTokens: boolean;
  componentsMissingTokens: string[];
}

function getSnapshotsNeedingPatch(): SnapshotInfo[] {
  const results: SnapshotInfo[] = [];
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => /^v[56]/.test(f) && f.endsWith('.json'));

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
    const version: string = data.version;
    if (!version) continue;

    const missingGlobalTokens = !data.globalTokens || data.globalTokens.length === 0;

    const componentsMissingTokens: string[] = [];
    if (Array.isArray(data.components)) {
      for (const comp of data.components) {
        if (!comp.tokens || comp.tokens.length === 0) {
          componentsMissingTokens.push(comp.name);
        }
      }
    }

    // Only patch files missing globalTokens — these are the ones corrupted by sync failures.
    // Files with globalTokens but some component.tokens missing are left alone (component
    // tokens may genuinely not exist in that antd version).
    if (missingGlobalTokens) {
      results.push({ file, version, missingGlobalTokens, componentsMissingTokens });
    }
  }
  return results;
}

function patchFile(snap: SnapshotInfo, meta: TokenMetaFile, dryRun: boolean): void {
  const filePath = path.join(dataDir, snap.file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = false;

  // Patch globalTokens
  if (snap.missingGlobalTokens) {
    const globalTokens = extractGlobalTokens(meta);
    if (globalTokens.length > 0) {
      data.globalTokens = globalTokens;
      console.log(`  + globalTokens: ${globalTokens.length}`);
      changed = true;
    }
  }

  // Patch component tokens
  const compMeta = meta.components;
  if (snap.componentsMissingTokens.length > 0 && compMeta && typeof compMeta === 'object') {
    let patched = 0;
    for (const comp of data.components) {
      if ((!comp.tokens || comp.tokens.length === 0) && comp.name in compMeta) {
        const tokens = extractComponentTokens(meta, comp.name);
        if (tokens.length > 0) {
          comp.tokens = tokens;
          patched++;
        }
      }
    }
    if (patched > 0) {
      console.log(`  + component tokens patched: ${patched} components`);
      changed = true;
    }
  }

  if (changed && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  }

  if (!changed) {
    console.log('  (no token-meta data available, skipping)');
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) console.log('DRY RUN — no files will be modified\n');

  const snapshots = getSnapshotsNeedingPatch();
  console.log(`Found ${snapshots.length} v5/v6 snapshot files needing token patch\n`);

  for (const snap of snapshots) {
    console.log(`${snap.file} (antd@${snap.version})`);
    if (snap.missingGlobalTokens) console.log(`  missing: globalTokens`);
    if (snap.componentsMissingTokens.length > 0) {
      console.log(`  missing: component tokens for ${snap.componentsMissingTokens.length} components`);
    }

    const meta = fetchTokenMeta(snap.version);
    if (!meta) {
      console.log('  (could not fetch token-meta, skipping)\n');
      continue;
    }

    patchFile(snap, meta, dryRun);
    console.log();
  }

  // Cleanup temp
  if (fs.existsSync(tmpBase)) {
    fs.rmSync(tmpBase, { recursive: true });
  }

  console.log('Done.');
}

main();