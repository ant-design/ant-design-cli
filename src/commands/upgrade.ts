import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { execFile, spawn } from 'node:child_process';
import { compare, valid } from '../data/version.js';
import { output } from '../output/formatter.js';
import { createError, printError, ErrorCodes } from '../output/error.js';
import { detectPackageManager, UPGRADE_COMMANDS } from '../utils/detect-pm.js';
import { fetchLatestVersion } from '../utils/update-check.js';

declare const __CLI_VERSION__: string;

interface AlreadyUpToDateResult {
  currentVersion: string;
  message: string;
}

interface UpgradeSuccessResult {
  previousVersion: string;
  newVersion: string;
  packageManager: string;
}

type UpgradeResult = AlreadyUpToDateResult | UpgradeSuccessResult;

function formatUpgradeMarkdown(data: UpgradeResult): string {
  const lines = ['## Upgrade', ''];
  lines.push('| Field | Value |');
  lines.push('|---|---|');

  if ('newVersion' in data) {
    lines.push(`| Previous Version | ${data.previousVersion} |`);
    lines.push(`| New Version | ${data.newVersion} |`);
    lines.push(`| Package Manager | ${data.packageManager} |`);
  } else {
    lines.push(`| Current Version | ${data.currentVersion} |`);
    lines.push(`| Status | Already up to date |`);
  }

  return lines.join('\n');
}

function runUpgrade(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', timeout: 120_000 });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
}

/* v8 ignore start -- entry-point action; covered by e2e tests in cli.test.ts */
export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade the CLI to the latest version')
    .action(async () => {
      const opts = program.opts<GlobalOptions>();
      const currentVersion = __CLI_VERSION__;

      // Step 1: Fetch latest version
      let latestVersion: string | null;
      try {
        latestVersion = await fetchLatestVersion();
      } catch {
        const err = createError(
          ErrorCodes.NETWORK_ERROR,
          'Failed to fetch latest version from npm registry',
          'Check your network connection and try again.',
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      if (!latestVersion || !valid(latestVersion)) {
        const err = createError(
          ErrorCodes.NETWORK_ERROR,
          'Failed to determine latest version',
          'Check your network connection and try again.',
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      // Step 2: Compare versions
      if ((compare(currentVersion, latestVersion) ?? 0) >= 0) {
        const result: AlreadyUpToDateResult = {
          currentVersion,
          message: 'Already up to date',
        };
        if (opts.format === 'json') {
          output(result, 'json');
        } else if (opts.format === 'markdown') {
          console.log(formatUpgradeMarkdown(result));
        } else {
          console.log(`Already up to date: v${currentVersion}`);
        }
        return;
      }

      // Step 3: Detect package manager
      const pm = detectPackageManager();
      if (!pm) {
        const err = createError(
          ErrorCodes.PM_NOT_FOUND,
          'Could not detect which package manager installed the CLI',
          'Run manually: npm install -g @ant-design/cli@latest',
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      const { cmd, args } = UPGRADE_COMMANDS[pm];

      // Step 4: Print upgrade info (except json, which outputs at the end)
      if (opts.format !== 'json') {
        console.log(`Upgrading @ant-design/cli: v${currentVersion} → v${latestVersion}`);
        console.log(`Running: ${cmd} ${args.join(' ')}`);
      }

      // Step 5: Execute upgrade
      try {
        await runUpgrade(cmd, args);
      } catch {
        const err = createError(
          ErrorCodes.UPGRADE_FAILED,
          `Upgrade command failed: ${cmd} ${args.join(' ')}`,
          `Run manually: ${cmd} ${args.join(' ')}`,
        );
        printError(err, opts.format);
        process.exitCode = 2;
        return;
      }

      // Step 6: Verify upgraded version
      let newVersion: string | null = null;
      try {
        newVersion = await new Promise<string>((resolve, reject) => {
          execFile('antd', ['--cli-version'], { timeout: 10_000 }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout.trim());
          });
        });
      } catch {
        // Verification failed but upgrade may have succeeded
      }

      if (newVersion && valid(newVersion) && (compare(currentVersion, newVersion) ?? 0) < 0) {
        const result: UpgradeSuccessResult = {
          previousVersion: currentVersion,
          newVersion,
          packageManager: pm,
        };
        if (opts.format === 'json') {
          output(result, 'json');
        } else if (opts.format === 'markdown') {
          console.log(formatUpgradeMarkdown(result));
        } else {
          console.log(`Successfully upgraded to v${newVersion}`);
        }
      } else if (newVersion && newVersion === currentVersion) {
        const err = createError(
          ErrorCodes.VERSION_UNCHANGED,
          `Upgrade command succeeded but version is still v${currentVersion}`,
          'Check if you have the required permissions or try running the command manually.',
        );
        printError(err, opts.format);
        process.exitCode = 2;
      } else {
        // Verification inconclusive — report success based on the command exit code
        const result: UpgradeSuccessResult = {
          previousVersion: currentVersion,
          newVersion: latestVersion,
          packageManager: pm,
        };
        if (opts.format === 'json') {
          output(result, 'json');
        } else if (opts.format === 'markdown') {
          console.log(formatUpgradeMarkdown(result));
        } else {
          console.log(`Successfully upgraded to v${latestVersion}`);
        }
      }
    });
}
/* v8 ignore stop */