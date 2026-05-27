import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { localize } from '../types.js';
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

function formatUpgradeMarkdown(data: UpgradeResult, lang: string): string {
  const lines = [`## ${localize('Upgrade', '升级', lang)}`, ''];
  lines.push(`| ${localize('Field', '字段', lang)} | ${localize('Value', '值', lang)} |`);
  lines.push('|---|---|');

  if ('newVersion' in data) {
    lines.push(`| ${localize('Previous Version', '升级前版本', lang)} | ${data.previousVersion} |`);
    lines.push(`| ${localize('New Version', '升级后版本', lang)} | ${data.newVersion} |`);
    lines.push(`| ${localize('Package Manager', '包管理器', lang)} | ${data.packageManager} |`);
  } else {
    lines.push(`| ${localize('Current Version', '当前版本', lang)} | ${data.currentVersion} |`);
    lines.push(`| ${localize('Status', '状态', lang)} | ${localize('Already up to date', '已是最新版本', lang)} |`);
  }

  return lines.join('\n');
}

const IS_WIN = process.platform === 'win32';

function runUpgrade(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      timeout: 120_000,
      /* v8 ignore next -- Windows-only branch */
      ...(IS_WIN ? { shell: true } : {}),
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else if (code !== null) reject(new Error(`Process exited with code ${code}`));
      else reject(new Error(`Process killed by signal ${signal ?? 'unknown'}`));
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
          localize(
            'Failed to fetch latest version from npm registry',
            '无法从 npm 获取最新版本',
            opts.lang,
          ),
          localize(
            'Check your network connection and try again.',
            '请检查网络连接后重试。',
            opts.lang,
          ),
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      if (!latestVersion || !valid(latestVersion)) {
        const err = createError(
          ErrorCodes.NETWORK_ERROR,
          localize(
            'Failed to determine latest version',
            '无法确定最新版本',
            opts.lang,
          ),
          localize(
            'Check your network connection and try again.',
            '请检查网络连接后重试。',
            opts.lang,
          ),
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      // Step 2: Compare versions
      const cmp = compare(currentVersion, latestVersion);
      // If currentVersion is unparseable (e.g. dev build), proceed with upgrade
      if (cmp !== null && cmp >= 0) {
        const result: AlreadyUpToDateResult = {
          currentVersion,
          message: localize('Already up to date', '已是最新版本', opts.lang),
        };
        if (opts.format === 'json') {
          output(result, 'json');
        } else if (opts.format === 'markdown') {
          console.log(formatUpgradeMarkdown(result, opts.lang));
        } else {
          console.log(localize(`Already up to date: v${currentVersion}`, `已是最新版本: v${currentVersion}`, opts.lang));
        }
        return;
      }

      // Step 3: Detect package manager
      const pm = detectPackageManager();
      if (!pm) {
        const err = createError(
          ErrorCodes.PM_NOT_FOUND,
          localize(
            'Could not detect which package manager installed the CLI',
            '无法检测安装 CLI 的包管理器',
            opts.lang,
          ),
          localize(
            'Run manually: npm install -g @ant-design/cli@latest',
            '手动执行: npm install -g @ant-design/cli@latest',
            opts.lang,
          ),
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      const { cmd, args } = UPGRADE_COMMANDS[pm];

      // Skip the postAction update check since we just checked/upgraded
      process.env.NO_UPDATE_CHECK = '1';

      // Step 4: Print upgrade info (except json, which outputs at the end)
      if (opts.format !== 'json') {
        console.log(localize(`Upgrading @ant-design/cli: v${currentVersion} → v${latestVersion}`, `正在升级 @ant-design/cli: v${currentVersion} → v${latestVersion}`, opts.lang));
        console.log(localize(`Running: ${cmd} ${args.join(' ')}`, `执行: ${cmd} ${args.join(' ')}`, opts.lang));
      }

      // Step 5: Execute upgrade
      try {
        await runUpgrade(cmd, args);
      } catch {
        const err = createError(
          ErrorCodes.UPGRADE_FAILED,
          localize(
            `Upgrade command failed: ${cmd} ${args.join(' ')}`,
            `升级命令失败: ${cmd} ${args.join(' ')}`,
            opts.lang,
          ),
          localize(
            `Run manually: ${cmd} ${args.join(' ')}`,
            `手动执行: ${cmd} ${args.join(' ')}`,
            opts.lang,
          ),
        );
        printError(err, opts.format);
        process.exitCode = 2;
        return;
      }

      // Step 6: Verify upgraded version
      let newVersion: string | null = null;
      try {
        newVersion = await new Promise<string>((resolve, reject) => {
          execFile('antd', ['--cli-version'], { timeout: 10_000, /* v8 ignore next -- Windows-only branch */ ...(IS_WIN ? { shell: true } : {}) }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout.trim());
          });
        });
      } catch {
        // Verification failed but upgrade may have succeeded
      }

      if (newVersion && valid(newVersion) && (compare(currentVersion, newVersion) ?? -1) < 0) {
        const result: UpgradeSuccessResult = {
          previousVersion: currentVersion,
          newVersion,
          packageManager: pm,
        };
        if (opts.format === 'json') {
          output(result, 'json');
        } else if (opts.format === 'markdown') {
          console.log(formatUpgradeMarkdown(result, opts.lang));
        } else {
          console.log(localize(`Successfully upgraded to v${newVersion}`, `成功升级到 v${newVersion}`, opts.lang));
        }
      } else if (newVersion && newVersion === currentVersion) {
        const err = createError(
          ErrorCodes.VERSION_UNCHANGED,
          localize(
            `Upgrade command succeeded but version is still v${currentVersion}`,
            `升级命令执行成功但版本仍为 v${currentVersion}`,
            opts.lang,
          ),
          localize(
            'Check if you have the required permissions or try running the command manually.',
            '请检查是否有足够权限，或尝试手动执行升级命令。',
            opts.lang,
          ),
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
          console.log(formatUpgradeMarkdown(result, opts.lang));
        } else {
          console.log(localize(`Successfully upgraded to v${latestVersion}`, `成功升级到 v${latestVersion}`, opts.lang));
        }
      }
    });
}
/* v8 ignore stop */
