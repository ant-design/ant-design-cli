#!/usr/bin/env node
/**
 * Patch globalTokens in all snapshot JSON files to add missing `name` fields.
 *
 * Uses npm pack to download each antd version's token-meta.json and maps
 * token names back to snapshot entries via the `descEn` → `description` field.
 *
 * Usage:
 *   npx tsx scripts/patch-token-names.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

const dataDir = path.resolve('data');
const tmpBase = path.join(os.tmpdir(), 'antd-token-patch');

function getSnapshotFiles(): Array<{ file: string; version: string }> {
  return fs
    .readdirSync(dataDir)
    .filter((f) => /^v[56]/.test(f) && f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'));
      return { file: f, version: data.version as string };
    })
    .filter(({ version }) => !!version);
}

function fetchTokenMeta(version: string): Record<string, { descEn?: string; type?: string }> {
  const tmpDir = path.join(tmpBase, version);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const metaPath = path.join(tmpDir, 'token-meta.json');
  if (fs.existsSync(metaPath)) {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8')).global || {};
  }

  console.log(`  Downloading antd@${version}...`);
  try {
    execSync(`npm pack antd@${version} --quiet 2>/dev/null`, { cwd: tmpDir, stdio: 'pipe' });
    const tarball = fs.readdirSync(tmpDir).find((f) => f.endsWith('.tgz'));
    if (!tarball) throw new Error('tarball not found');
    execSync(`tar -xzf ${tarball} package/es/version/token-meta.json`, {
      cwd: tmpDir,
      stdio: 'pipe',
    });
    const extracted = path.join(tmpDir, 'package', 'es', 'version', 'token-meta.json');
    if (!fs.existsSync(extracted)) throw new Error('token-meta.json not found in package');
    const meta = JSON.parse(fs.readFileSync(extracted, 'utf-8'));
    fs.copyFileSync(extracted, metaPath);
    return meta.global || {};
  } catch (e) {
    console.warn(`  Warning: could not fetch antd@${version}: ${(e as Error).message}`);
    return {};
  }
}

function buildDescEnToNameMap(
  global: Record<string, { descEn?: string; type?: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [tokenName, entry] of Object.entries(global)) {
    const key = entry.descEn?.trim();
    if (key) map.set(key, tokenName);
  }
  return map;
}

function patchFile(file: string, version: string): number {
  const filePath = path.join(dataDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const globalTokens: Array<{ name?: string; description?: string }> = data.globalTokens || [];
  if (globalTokens.length === 0) return 0;

  // Check if names already present
  if (globalTokens.every((t) => t.name)) return 0;

  const globalMeta = fetchTokenMeta(version);
  if (Object.keys(globalMeta).length === 0) return 0;

  const descToName = buildDescEnToNameMap(globalMeta);

  let patched = 0;
  for (const token of globalTokens) {
    if (!token.name && token.description) {
      const name = descToName.get(token.description.trim());
      if (name) {
        token.name = name;
        patched++;
      }
    }
  }

  if (patched > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  }

  return patched;
}

function main() {
  const snapshots = getSnapshotFiles();
  console.log(`Found ${snapshots.length} v5/v6 snapshot files`);

  let totalPatched = 0;
  let filesPatched = 0;

  for (const { file, version } of snapshots) {
    process.stdout.write(`Patching ${file} (antd@${version})... `);
    const count = patchFile(file, version);
    if (count > 0) {
      console.log(`patched ${count} tokens`);
      filesPatched++;
      totalPatched += count;
    } else {
      console.log('skipped (already patched or no match)');
    }
  }

  console.log(`\nDone: patched ${totalPatched} tokens across ${filesPatched} files`);

  // Cleanup temp
  if (fs.existsSync(tmpBase)) {
    fs.rmSync(tmpBase, { recursive: true });
  }
}

main();
