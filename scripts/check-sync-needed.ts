#!/usr/bin/env node

/**
 * Check whether sync.yml needs to run.
 *
 * Outputs (via GITHUB_OUTPUT):
 *   needs_sync    — antd has a new version not in local data
 *   needs_publish — CLI for the synced version hasn't been published yet (recovery scenario)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const latestAntd = execSync('npm view antd version', { encoding: 'utf8' }).trim();
const syncedVersion: string = JSON.parse(fs.readFileSync('data/v6.json', 'utf8')).version;

console.log(`Latest antd on npm: ${latestAntd}`);
console.log(`Local synced version: ${syncedVersion}`);

const needsSync = latestAntd !== syncedVersion;
const alreadyPublished = !needsSync && (() => {
  try {
    execSync(`npm view "@ant-design/cli@${syncedVersion}" version`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();
const needsPublish = needsSync || !alreadyPublished;

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  fs.appendFileSync(outputFile, `needs_sync=${needsSync}\n`);
  fs.appendFileSync(outputFile, `needs_publish=${needsPublish}\n`);
}

if (!needsSync && !needsPublish) {
  console.log('Data up to date and CLI published, nothing to do');
}

console.log(`needs_sync=${needsSync}, needs_publish=${needsPublish}`);