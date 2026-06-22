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

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { getErrorText, isNpmPackageNotFoundError } from './utils/npm-errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const MAJORS = [4, 5, 6];

interface SyncStatusOptions {
  majors: number[];
  getLatestNpmVersion: (major: number) => string | null;
  getLocalVersion: (major: number) => string | null;
  isCliVersionPublished: (version: string) => boolean;
  gitTagExists: (version: string) => boolean;
  githubReleaseExists: (version: string) => boolean;
}

export function getLatestStableVersion(output: string): string | null {
  let versions: unknown;
  try {
    versions = JSON.parse(output);
  } catch {
    versions = output
      .split(/\r?\n/)
      .map((line) => line.match(/'([^']+)'/)?.[1] ?? line.trim());
  }

  const list = (Array.isArray(versions) ? versions : [versions])
    .filter((version): version is string => typeof version === 'string')
    .filter((version) => semver.valid(version) && !semver.prerelease(version));

  return list.sort(semver.compare).at(-1) ?? null;
}

function getLatestNpmVersion(major: number): string | null {
  try {
    const output = execFileSync('npm', ['view', `antd@${major}`, 'version', '--json'], { encoding: 'utf8' });
    return getLatestStableVersion(output);
  } catch (err) {
    if (!isNpmPackageNotFoundError(err)) {
      throw err;
    }
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

function isCliVersionPublished(version: string): boolean {
  try {
    execFileSync('npm', ['view', `@ant-design/cli@${version}`, 'version'], { stdio: 'pipe' });
    return true;
  } catch (err) {
    if (!isNpmPackageNotFoundError(err)) {
      throw err;
    }
    return false;
  }
}

function gitTagExists(version: string): boolean {
  return execFileSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/v${version}`], { encoding: 'utf8' }).trim().length > 0;
}

function isGithubReleaseNotFoundError(err: unknown): boolean {
  const errorText = getErrorText(err);
  return errorText.includes('release not found')
    || errorText.includes('http 404')
    || errorText.includes('could not resolve to a release');
}

function githubReleaseExists(version: string): boolean {
  try {
    execFileSync('gh', ['release', 'view', `v${version}`], { stdio: 'pipe' });
    return true;
  } catch (err) {
    if (!isGithubReleaseNotFoundError(err)) {
      throw err;
    }
    return false;
  }
}

export function resolveSyncStatus(options: SyncStatusOptions) {
  let needsSync = false;
  const statusLines: string[] = [];

  for (const major of options.majors) {
    const latest = options.getLatestNpmVersion(major);
    const local = options.getLocalVersion(major);
    const outdated = latest !== null && latest !== local;
    if (outdated) needsSync = true;
    statusLines.push(`  v${major}: npm=${latest ?? 'unavailable'}, local=${local ?? 'missing'}${outdated ? ' (outdated)' : ''}`);
  }

  const v6Local = options.getLocalVersion(6);
  const needsPublish =
    needsSync ||
    !v6Local ||
    !options.isCliVersionPublished(v6Local) ||
    !options.gitTagExists(v6Local) ||
    !options.githubReleaseExists(v6Local);

  return { needsSync, needsPublish, statusLines };
}

function main() {
  const { needsSync, needsPublish, statusLines } = resolveSyncStatus({
    majors: MAJORS,
    getLatestNpmVersion,
    getLocalVersion,
    isCliVersionPublished,
    gitTagExists,
    githubReleaseExists,
  });

  console.log('Version check:');
  console.log(statusLines.join('\n'));

  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `needs_sync=${needsSync}\n`);
    fs.appendFileSync(outputFile, `needs_publish=${needsPublish}\n`);
  }

  if (!needsSync && !needsPublish) {
    console.log('Data up to date and CLI published, nothing to do');
  }

  console.log(`needs_sync=${needsSync}, needs_publish=${needsPublish}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
