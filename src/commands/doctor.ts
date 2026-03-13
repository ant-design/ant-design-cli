import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { output } from '../output/formatter.js';
import { readJson } from '../utils/scan.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  severity?: 'warning' | 'error';
  message: string;
  suggestion?: string;
}

/** Pre-read context shared across all checks to avoid repeated file I/O. */
interface DoctorContext {
  cwd: string;
  antdPkg: any | null;
  antdMajor: number;
  projectPkg: any | null;
  reactPkg: any | null;
}

function buildContext(cwd: string): DoctorContext {
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const antdMajor = antdPkg ? parseInt(antdPkg.version.split('.')[0], 10) : 0;
  const projectPkg = readJson(join(cwd, 'package.json'));
  const reactPkg = readJson(join(cwd, 'node_modules', 'react', 'package.json'));
  return { cwd, antdPkg, antdMajor, projectPkg, reactPkg };
}

function checkAntdInstalled(ctx: DoctorContext): CheckResult {
  if (!ctx.antdPkg) {
    return {
      name: 'antd-installed',
      status: 'fail',
      severity: 'error',
      message: 'antd is not installed in node_modules',
      suggestion: 'Run `npm install antd` or `yarn add antd`',
    };
  }
  return {
    name: 'antd-installed',
    status: 'pass',
    message: `antd ${ctx.antdPkg.version || 'unknown'} is installed`,
  };
}

function checkReactCompat(ctx: DoctorContext): CheckResult {
  if (!ctx.antdPkg || !ctx.reactPkg) {
    return {
      name: 'react-compat',
      status: 'warn',
      severity: 'warning',
      message: 'Cannot verify React compatibility — antd or react not found in node_modules',
    };
  }

  const reactMajor = parseInt(ctx.reactPkg.version.split('.')[0], 10);

  if (ctx.antdMajor >= 5 && reactMajor < 18) {
    return {
      name: 'react-compat',
      status: 'fail',
      severity: 'error',
      message: `React ${ctx.reactPkg.version} may not be compatible with antd ${ctx.antdPkg.version}`,
      suggestion: 'antd 5.x requires React 18+. Consider upgrading React.',
    };
  }

  return {
    name: 'react-compat',
    status: 'pass',
    message: `React ${ctx.reactPkg.version} is compatible with antd ${ctx.antdPkg.version}`,
  };
}

function checkDuplicateInstall(ctx: DoctorContext): CheckResult {
  const versions: string[] = [];

  if (ctx.antdPkg?.version) versions.push(ctx.antdPkg.version);

  const nmDir = join(ctx.cwd, 'node_modules');
  try {
    const entries = readdirSync(nmDir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'antd') continue;
      const nestedPkg = readJson(join(nmDir, entry, 'node_modules', 'antd', 'package.json'));
      if (nestedPkg?.version && !versions.includes(nestedPkg.version)) {
        versions.push(nestedPkg.version);
      }
    }
  } catch {
    // ignore read errors
  }

  if (versions.length > 1) {
    return {
      name: 'duplicate-install',
      status: 'fail',
      severity: 'error',
      message: `Found ${versions.length} antd installations: ${versions.join(', ')}`,
      suggestion: 'Run `npm dedupe` or check your dependency tree',
    };
  }

  return {
    name: 'duplicate-install',
    status: 'pass',
    message: 'No duplicate antd installations detected',
  };
}

function checkThemeConfig(ctx: DoctorContext): CheckResult {
  if (ctx.antdMajor >= 5) {
    // Check for old Less variable customization (should not exist in v5+)
    const lessOverrides = readJson(join(ctx.cwd, 'theme', 'antd.less'));
    const modifyVars = ctx.projectPkg?.theme;
    if (lessOverrides !== null || modifyVars) {
      return {
        name: 'theme-config',
        status: 'warn',
        severity: 'warning',
        message: 'Found Less-based theme customization, but antd v5+ uses Design Tokens',
        suggestion: 'Migrate Less variables to ConfigProvider theme tokens. See https://ant.design/docs/react/migrate-less-variables',
      };
    }
  }

  return {
    name: 'theme-config',
    status: 'pass',
    message: 'No theme configuration issues detected',
  };
}

function checkBabelPlugins(ctx: DoctorContext): CheckResult {
  const babelConfigs = ['.babelrc', 'babel.config.js', 'babel.config.json'];

  let hasBabelPluginImport = false;

  for (const configName of babelConfigs) {
    try {
      const content = readFileSync(join(ctx.cwd, configName), 'utf-8');
      if (content.includes('babel-plugin-import') || content.includes('import, { libraryName')) {
        hasBabelPluginImport = true;
        break;
      }
    } catch { /* file doesn't exist or can't be read */ }
  }

  // Also check package.json babel config
  if (!hasBabelPluginImport && ctx.projectPkg?.babel) {
    const babelStr = JSON.stringify(ctx.projectPkg.babel);
    if (babelStr.includes('babel-plugin-import')) {
      hasBabelPluginImport = true;
    }
  }

  if (hasBabelPluginImport && ctx.antdMajor >= 5) {
    return {
      name: 'babel-plugin',
      status: 'warn',
      severity: 'warning',
      message: 'babel-plugin-import is configured but not needed for antd v5+',
      suggestion: 'antd v5+ supports tree-shaking natively. Remove babel-plugin-import for antd to reduce build complexity.',
    };
  }

  return {
    name: 'babel-plugin',
    status: 'pass',
    message: 'No problematic Babel/webpack antd plugins detected',
  };
}

function checkCssInJs(ctx: DoctorContext): CheckResult {
  const cssinjs = readJson(join(ctx.cwd, 'node_modules', '@ant-design', 'cssinjs', 'package.json'));
  if (!cssinjs) {
    return {
      name: 'cssinjs',
      status: 'warn',
      severity: 'warning',
      message: 'No @ant-design/cssinjs found, SSR style extraction will not work',
      suggestion: 'Install @ant-design/cssinjs if you need SSR support',
    };
  }
  return {
    name: 'cssinjs',
    status: 'pass',
    message: '@ant-design/cssinjs is installed',
  };
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose project-level antd configuration issues')
    .action(() => {
      const opts = program.opts<GlobalOptions>();
      const ctx = buildContext(process.cwd());

      const checks: CheckResult[] = [
        checkAntdInstalled(ctx),
        checkReactCompat(ctx),
        checkDuplicateInstall(ctx),
        checkThemeConfig(ctx),
        checkBabelPlugins(ctx),
        checkCssInJs(ctx),
      ];

      const summary = {
        pass: checks.filter((c) => c.status === 'pass').length,
        warn: checks.filter((c) => c.status === 'warn').length,
        fail: checks.filter((c) => c.status === 'fail').length,
      };

      if (opts.format === 'json') {
        output({ checks, summary }, 'json');
        return;
      }

      const ICONS = { pass: '✓', warn: '⚠', fail: '✗' };
      console.log('antd Doctor\n');

      for (const check of checks) {
        const icon = ICONS[check.status];
        console.log(`  ${icon} [${check.name}] ${check.message}`);
        if (check.suggestion) {
          console.log(`    → ${check.suggestion}`);
        }
      }

      console.log('');
      console.log(`Summary: ${summary.pass} passed, ${summary.warn} warnings, ${summary.fail} failed`);
    });
}
