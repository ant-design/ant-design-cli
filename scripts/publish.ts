#!/usr/bin/env node
/**
 * Publish script for sync.yml workflow.
 * Handles version check, git operations, and npm publish.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function run(cmd: string, options?: { cwd?: string; stdio?: 'pipe' | 'inherit' }): string {
  const result = execSync(cmd, {
    encoding: 'utf-8',
    stdio: options?.stdio ?? 'pipe',
    cwd: options?.cwd,
  });
  // execSync returns null when stdio is 'inherit'
  return result?.trim() ?? '';
}

function getNpmVersion(pkgName: string, version: string): string | null {
  try {
    return run(`npm view "${pkgName}@${version}" version 2>/dev/null || true`);
  } catch {
    return null;
  }
}

interface PublishPlanInput {
  cliVersion: string;
  oldVersion: string;
  existingVersion: string | null;
  existingGitTag?: boolean;
  existingGithubRelease?: boolean;
  changedFiles: Set<string>;
}

export function getPublishPlan(input: PublishPlanInput) {
  const hasLocalChanges = input.changedFiles.size > 0 || input.cliVersion !== input.oldVersion;
  const shouldPublish = !input.existingVersion;
  const shouldTag = shouldPublish && input.existingGitTag !== true;
  const shouldRelease = shouldPublish && input.existingGithubRelease !== true;
  return {
    shouldCommit: hasLocalChanges,
    shouldPublish,
    shouldTag,
    shouldRelease,
    shouldSkip: !hasLocalChanges && !shouldPublish && !shouldTag && !shouldRelease,
  };
}

function gitTagExists(version: string): boolean {
  try {
    return run(`git ls-remote --tags origin "refs/tags/v${version}"`).length > 0;
  } catch {
    return false;
  }
}

export function isGithubReleaseNotFoundError(err: unknown): boolean {
  const error = err as { message?: unknown; stderr?: unknown };
  const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.toString('utf8') : String(error?.stderr ?? '');
  const message = `${String(error?.message ?? '')}\n${stderr}`.toLowerCase();
  return message.includes('not found') || message.includes('could not resolve to a release');
}

function githubReleaseExists(version: string): boolean {
  try {
    run(`gh release view "v${version}"`);
    return true;
  } catch (err) {
    if (!isGithubReleaseNotFoundError(err)) {
      throw err;
    }
    return false;
  }
}

function main() {
  // Get CLI version from v6.json (antd v6 version as CLI version)
  const v6Data = JSON.parse(readFileSync('data/v6.json', 'utf-8'));
  const cliVersion = v6Data.version;

  // Check if already published
  const existingVersion = getNpmVersion('@ant-design/cli', cliVersion);
  const existingGitTag = gitTagExists(cliVersion);
  const existingGithubRelease = githubReleaseExists(cliVersion);

  // Collect version info for changelog — only include versions whose data file actually changed
  const changedFiles = new Set(run('git diff --name-only HEAD -- data/').split(/\r?\n/).filter(Boolean));
  const versions: string[] = [];
  for (const major of [4, 5, 6]) {
    if (!changedFiles.has(`data/v${major}.json`)) continue;
    const data = JSON.parse(readFileSync(`data/v${major}.json`, 'utf-8'));
    versions.push(`v${major}@${data.version}`);
  }
  const versionsStr = versions.join(', ');

  // Get current package.json version
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  const oldVersion = pkg.version;
  const plan = getPublishPlan({ cliVersion, oldVersion, existingVersion, existingGitTag, existingGithubRelease, changedFiles });

  if (plan.shouldSkip) {
    console.log(`Version ${cliVersion} already published to npm and no local changes were found, skipping release`);
    process.exit(0);
  }

  // Update package.json version if needed
  if (cliVersion !== oldVersion) {
    run(`npm version "${cliVersion}" --no-git-tag-version`);

    // Update changelog
    run(`npx tsx scripts/update-changelog.ts --old "${oldVersion}" --new "${cliVersion}" --versions "${versionsStr}"`);
  } else {
    console.log(`package.json already has version ${cliVersion}, proceeding with publish`);
  }

  // Build and test BEFORE any git operations
  run('npm run build', { stdio: 'inherit' });
  run('npx vitest run --update', { stdio: 'inherit' });

  // Commit, tag and push only after successful build + test
  if (plan.shouldCommit) {
    run('git config user.name "github-actions[bot]"');
    run('git config user.email "github-actions[bot]@users.noreply.github.com"');
    run('git add data/ package.json package-lock.json CHANGELOG.md CHANGELOG.zh-CN.md src/__tests__/snapshots/');
    run(`git commit -m "data: sync antd metadata (${versionsStr || cliVersion})"`);

    if (plan.shouldTag) {
      run(`git tag "v${cliVersion}"`);
    }

    run(plan.shouldTag ? 'git push origin main --tags' : 'git push origin main');
  } else if (plan.shouldTag) {
    run(`git tag "v${cliVersion}"`);
    run(`git push origin "v${cliVersion}"`);
  }

  if (plan.shouldRelease) {
    // Create GitHub Release
    const releaseNotes = run(`npx tsx scripts/extract-changelog.ts "${cliVersion}"`);
    const releaseNotesPath = join(os.tmpdir(), `release-notes-${Date.now()}.md`);
    writeFileSync(releaseNotesPath, releaseNotes);
    run(`gh release create "v${cliVersion}" --title "v${cliVersion}" --notes-file "${releaseNotesPath}"`, { stdio: 'inherit' });
  }

  // Publish to npm (clear NODE_AUTH_TOKEN for OIDC Trusted Publishing)
  if (plan.shouldPublish) {
    run('NODE_AUTH_TOKEN="" npm publish --provenance --access public', { stdio: 'inherit' });

    console.log(`Successfully published @ant-design/cli@${cliVersion}`);
  } else {
    console.log(`Version ${cliVersion} already published to npm; committed synced data changes only`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
