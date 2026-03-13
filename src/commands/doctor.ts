import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { output } from '../output/formatter.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  severity?: 'warning' | 'error';
  message: string;
  suggestion?: string;
}

function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function checkAntdInstalled(cwd: string): CheckResult {
  const pkgPath = join(cwd, 'node_modules', 'antd', 'package.json');
  if (!existsSync(pkgPath)) {
    return {
      name: 'antd-installed',
      status: 'fail',
      severity: 'error',
      message: 'antd is not installed in node_modules',
      suggestion: 'Run `npm install antd` or `yarn add antd`',
    };
  }
  const pkg = readJson(pkgPath);
  return {
    name: 'antd-installed',
    status: 'pass',
    message: `antd ${pkg?.version || 'unknown'} is installed`,
  };
}

function checkReactCompat(cwd: string): CheckResult {
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const reactPkg = readJson(join(cwd, 'node_modules', 'react', 'package.json'));

  if (!antdPkg || !reactPkg) {
    return {
      name: 'react-compat',
      status: 'warn',
      severity: 'warning',
      message: 'Cannot verify React compatibility — antd or react not found in node_modules',
    };
  }

  const antdMajor = parseInt(antdPkg.version.split('.')[0], 10);
  const reactMajor = parseInt(reactPkg.version.split('.')[0], 10);

  if (antdMajor >= 5 && reactMajor < 18) {
    return {
      name: 'react-compat',
      status: 'fail',
      severity: 'error',
      message: `React ${reactPkg.version} may not be compatible with antd ${antdPkg.version}`,
      suggestion: 'antd 5.x requires React 18+. Consider upgrading React.',
    };
  }

  return {
    name: 'react-compat',
    status: 'pass',
    message: `React ${reactPkg.version} is compatible with antd ${antdPkg.version}`,
  };
}

function checkDuplicateInstall(cwd: string): CheckResult {
  const versions: string[] = [];

  // Check main node_modules
  const mainPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  if (mainPkg?.version) versions.push(mainPkg.version);

  // Check for nested antd in common dependency locations
  const nmDir = join(cwd, 'node_modules');
  if (existsSync(nmDir)) {
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

function checkThemeConfig(cwd: string): CheckResult {
  // Check for common theme config files
  const configFiles = [
    'theme.config.ts',
    'theme.config.js',
    '.antd.theme.json',
  ];
  const pkgPath = join(cwd, 'package.json');
  const pkg = readJson(pkgPath);

  // Check if antd theme is configured in package.json
  const hasThemeInPkg = pkg?.antd?.theme || pkg?.theme;

  // Check for ConfigProvider usage that might indicate theme config
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const antdMajor = antdPkg ? parseInt(antdPkg.version.split('.')[0], 10) : 0;

  // v5+ uses CSS-in-JS tokens, v4 uses Less variables
  if (antdMajor >= 5) {
    // Check for old Less variable customization (should not exist in v5+)
    const lessOverrides = join(cwd, 'theme', 'antd.less');
    const modifyVars = pkg?.theme;
    if (existsSync(lessOverrides) || modifyVars) {
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

function checkBabelPlugins(cwd: string): CheckResult {
  const pkg = readJson(join(cwd, 'package.json'));
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const antdMajor = antdPkg ? parseInt(antdPkg.version.split('.')[0], 10) : 0;

  // Check for babel-plugin-import (not needed in v5+)
  const babelRcPath = join(cwd, '.babelrc');
  const babelConfigPath = join(cwd, 'babel.config.js');
  const babelConfigJsonPath = join(cwd, 'babel.config.json');

  let hasBabelPluginImport = false;

  for (const configPath of [babelRcPath, babelConfigPath, babelConfigJsonPath]) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        if (content.includes('babel-plugin-import') || content.includes('import, { libraryName')) {
          hasBabelPluginImport = true;
          break;
        }
      } catch { /* ignore */ }
    }
  }

  // Also check package.json babel config
  if (pkg?.babel) {
    const babelStr = JSON.stringify(pkg.babel);
    if (babelStr.includes('babel-plugin-import')) {
      hasBabelPluginImport = true;
    }
  }

  if (hasBabelPluginImport && antdMajor >= 5) {
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

function checkCssInJs(cwd: string): CheckResult {
  const cssinjs = existsSync(join(cwd, 'node_modules', '@ant-design', 'cssinjs', 'package.json'));
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
      const cwd = process.cwd();

      const checks: CheckResult[] = [
        checkAntdInstalled(cwd),
        checkReactCompat(cwd),
        checkDuplicateInstall(cwd),
        checkThemeConfig(cwd),
        checkBabelPlugins(cwd),
        checkCssInJs(cwd),
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
