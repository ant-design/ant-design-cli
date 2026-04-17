#!/usr/bin/env node

/**
 * Check whether sync.yml needs to run.
 *
 * Outputs (via GITHUB_OUTPUT):
 *   needs_sync    — antd has a new version not in local data
 *   needs_publish — CLI for the synced version hasn't been published yet (recovery scenario)
 *
 * Exit code 0 always — the workflow reads the outputs to decide which steps to run.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const LATEST_ANTD = execSync('npm view antd version', { encoding: 'utf8' }).trim();
const SYNCED_VERSION = JSON.parse(fs.readFileSync('data/v6.json', 'utf8')).version;

console.log(`Latest antd on npm: ${LATEST_ANTD}`);
console.log(`Local synced version: ${SYNCED_VERSION}`);

const needsSync = LATEST_ANTD !== SYNCED_VERSION;
let needsPublish = false;

if (!needsSync) {
  // Data is up to date — but maybe publish failed last time?
  try {
    execSync(`npm view "@ant-design/cli@${SYNCED_VERSION}" version`, { stdio: 'pipe' });
  } catch {
    needsPublish = true;
  }
} else {
  needsPublish = true; // new version always requires publish
}

// Write GITHUB_OUTPUT
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  const append = (key: string, value: string) => {
    fs.appendFileSync(outputFile, `${key}=${value}\n`);
  };
  append('needs_sync', String(needsSync));
  append('needs_publish', String(needsPublish));
}

if (!needsSync && !needsPublish) {
  console.log('Data up to date and CLI published, nothing to do');
  process.exit(0);
}

console.log(`needs_sync=${needsSync}, needs_publish=${needsPublish}`);