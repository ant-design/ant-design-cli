#!/usr/bin/env node
/**
 * Publish script for sync.yml workflow.
 * Handles version check, git operations, and npm publish.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GH_TOKEN = process.env.GH_TOKEN;

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

function main() {
  // Get CLI version from v6.json (antd v6 version as CLI version)
  const v6Data = JSON.parse(readFileSync('data/v6.json', 'utf-8'));
  const cliVersion = v6Data.version;

  // Check if already published
  const existingVersion = getNpmVersion('@ant-design/cli', cliVersion);
  if (existingVersion) {
    console.log(`Version ${cliVersion} already published to npm, skipping release`);
    process.exit(0);
  }

  // Collect version info for changelog — only include versions that actually changed
  const versions: string[] = [];
  for (const major of [4, 5, 6]) {
    const data = JSON.parse(readFileSync(`data/v${major}.json`, 'utf-8'));
    try {
      const oldData = JSON.parse(run(`git show HEAD:data/v${major}.json`));
      if (data.version === oldData.version) continue;
    } catch {
      // New file, include it
    }
    versions.push(`v${major}@${data.version}`);
  }
  const versionsStr = versions.join(', ');

  // Get current package.json version
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  const oldVersion = pkg.version;

  // Update package.json version if needed
  if (cliVersion !== oldVersion) {
    run(`npm version "${cliVersion}" --no-git-tag-version`);

    // Update changelog
    run(`npx tsx scripts/update-changelog.ts --old "${oldVersion}" --new "${cliVersion}" --versions "${versionsStr}"`);

    // Commit, tag and push
    run('git config user.name "github-actions[bot]"');
    run('git config user.email "github-actions[bot]@users.noreply.github.com"');
    run('git add data/ package.json package-lock.json CHANGELOG.md CHANGELOG.zh-CN.md');
    run(`git commit -m "data: sync antd metadata (${versionsStr})"`);
    run(`git tag "v${cliVersion}"`);
    run('git push origin main --tags');

    // Create GitHub Release
    const releaseNotes = run(`npx tsx scripts/extract-changelog.ts "${cliVersion}"`);
    writeFileSync('/tmp/release-notes.md', releaseNotes);
    run(`gh release create "v${cliVersion}" --title "v${cliVersion}" --notes-file /tmp/release-notes.md`, { stdio: 'inherit' });
  } else {
    console.log(`package.json already has version ${cliVersion}, proceeding with publish`);
  }

  // Build and test
  run('npm run build', { stdio: 'inherit' });
  run('npm test', { stdio: 'inherit' });

  // Publish to npm (clear NODE_AUTH_TOKEN for OIDC Trusted Publishing)
  run('NODE_AUTH_TOKEN="" npm publish --provenance --access public', { stdio: 'inherit' });

  console.log(`Successfully published @ant-design/cli@${cliVersion}`);
}

main();