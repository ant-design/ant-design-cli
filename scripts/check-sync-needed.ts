#!/usr/bin/env node

/**
 * Check whether sync.yml needs to run.
 *
 * Checks all major versions (v4, v5, v6) against the latest npm dist-tag
 * for each major line. Also checks if the CLI package for the synced
 * version has been published (recovery scenario).
 *
 * Outputs (via GITHUB_OUTPUT):
 *   needs_sync    — antd has a new version not in local data for any major
 *   needs_publish — CLI for the synced version hasn't been published yet
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const MAJORS = [4, 5, 6];

function getLatestNpmVersion(major: number): string | null {
  try {
    return execSync(`npm view antd@${major} version`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getLocalVersion(major: number): string | null {
  const file = path.join(DATA_DIR, `v${major}.json`);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8')).version;
    }
  } catch {
    // corrupted file, needs re-sync
  }
  return null;
}

let needsSync = false;
const statusLines: string[] = [];

for (const major of MAJORS) {
  const latest = getLatestNpmVersion(major);
  const local = getLocalVersion(major);
  const outdated = latest !== null && latest !== local;
  if (outdated) needsSync = true;
  statusLines.push(`  v${major}: npm=${latest ?? 'unavailable'}, local=${local ?? 'missing'}${outdated ? ' (outdated)' : ''}`);
}

console.log('Version check:');
console.log(statusLines.join('\n'));

// Check if CLI package has been published for the current v6 version
const v6Local = getLocalVersion(6);
const needsPublish = needsSync || (() => {
  if (!v6Local) return true;
  try {
    execSync(`npm view "@ant-design/cli@${v6Local}" version`, { stdio: 'pipe' });
    return false;
  } catch {
    return true;
  }
})();

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  fs.appendFileSync(outputFile, `needs_sync=${needsSync}\n`);
  fs.appendFileSync(outputFile, `needs_publish=${needsPublish}\n`);
}

if (!needsSync && !needsPublish) {
  console.log('Data up to date and CLI published, nothing to do');
}

console.log(`needs_sync=${needsSync}, needs_publish=${needsPublish}`);