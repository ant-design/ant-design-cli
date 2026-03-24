import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { output } from '../output/formatter.js';
import { readJson } from '../utils/scan.js';
import { satisfies } from '../data/version.js';

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
  cssinjsPkg: any | null;
  iconsPkg: any | null;
  ecosystemPackages: EcosystemPackage[];
}

interface EcosystemPackage {
  name: string;       // e.g. "@ant-design/pro-components"
  shortName: string;  // e.g. "pro-components"
  version: string;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
}

/**
 * Read the installed version of a package from node_modules.
 * Returns null if not installed. Handles scoped packages (e.g. "@ant-design/cssinjs").
 */
function getInstalledVersion(cwd: string, pkgName: string): string | null {
  const pkg = readJson(join(cwd, 'node_modules', pkgName, 'package.json'));
  return pkg?.version ?? null;
}

/**
 * Scan node_modules/@ant-design/ for all installed scoped packages that declare peerDependencies.
 * Packages with no peerDependencies are skipped (no check emitted for them).
 * Note: antd itself lives at node_modules/antd/, not here, so it will never appear in this scan.
 */
function scanEcosystemPackages(cwd: string): EcosystemPackage[] {
  const scopeDir = join(cwd, 'node_modules', '@ant-design');
  let entries: string[];
  try {
    entries = readdirSync(scopeDir);
  } catch {
    return [];
  }

  const result: EcosystemPackage[] = [];
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const pkg = readJson(join(scopeDir, entry, 'package.json'));
    if (!pkg?.version) continue;
    const peerDeps: Record<string, string> = pkg.peerDependencies ?? {};
    if (Object.keys(peerDeps).length === 0) continue;
    result.push({
      name: `@ant-design/${entry}`,
      shortName: entry,
      version: pkg.version,
      peerDependencies: peerDeps,
      peerDependenciesMeta: pkg.peerDependenciesMeta ?? {},
    });
  }
  return result;
}

function buildContext(cwd: string): DoctorContext {
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const antdMajor = antdPkg ? parseInt(antdPkg.version.split('.')[0], 10) : 0;
  const projectPkg = readJson(join(cwd, 'package.json'));
  const reactPkg = readJson(join(cwd, 'node_modules', 'react', 'package.json'));
  const cssinjsPkg = readJson(join(cwd, 'node_modules', '@ant-design', 'cssinjs', 'package.json'));
  const iconsPkg = readJson(join(cwd, 'node_modules', '@ant-design', 'icons', 'package.json'));
  const ecosystemPackages = scanEcosystemPackages(cwd);
  return { cwd, antdPkg, antdMajor, projectPkg, reactPkg, cssinjsPkg, iconsPkg, ecosystemPackages };
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

/**
 * Scans top-level node_modules and one level of nested node_modules for
 * installations of pkgPath (e.g. 'dayjs' or '@ant-design/cssinjs').
 * Returns a deduplicated array of distinct version strings found.
 * If the package is not installed anywhere, returns [].
 */
function findDuplicateVersions(cwd: string, pkgPath: string): string[] {
  const versions: string[] = [];

  // 1. Top-level install
  const topPkg = readJson(join(cwd, 'node_modules', pkgPath, 'package.json'));
  if (topPkg?.version) versions.push(topPkg.version);

  // 2. One level of nesting: node_modules/*/node_modules/<pkgPath>
  const nmDir = join(cwd, 'node_modules');
  try {
    const entries = readdirSync(nmDir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === pkgPath) continue;
      const nestedPkg = readJson(join(nmDir, entry, 'node_modules', pkgPath, 'package.json'));
      if (nestedPkg?.version) versions.push(nestedPkg.version);
    }
  } catch {
    // ignore read errors (e.g. node_modules doesn't exist)
  }

  // Deduplicate
  return [...new Set(versions)];
}

function checkDuplicateInstall(ctx: DoctorContext): CheckResult {
  const versions = findDuplicateVersions(ctx.cwd, 'antd');

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

function checkDayjsDuplicate(ctx: DoctorContext): CheckResult {
  const versions = findDuplicateVersions(ctx.cwd, 'dayjs');

  if (versions.length > 1) {
    return {
      name: 'dayjs-duplicate',
      status: 'fail',
      severity: 'error',
      message: `Found ${versions.length} dayjs installations: ${versions.join(', ')}`,
      suggestion: 'Run `npm dedupe` or check your monorepo hoisting config',
    };
  }

  return {
    name: 'dayjs-duplicate',
    status: 'pass',
    message: 'No duplicate dayjs installations detected',
  };
}

function checkCssinjsDuplicate(ctx: DoctorContext): CheckResult {
  const versions = findDuplicateVersions(ctx.cwd, '@ant-design/cssinjs');

  if (versions.length > 1) {
    return {
      name: 'cssinjs-duplicate',
      status: 'fail',
      severity: 'error',
      message: `Found ${versions.length} @ant-design/cssinjs installations: ${versions.join(', ')}`,
      suggestion: 'Run `npm dedupe` or check your monorepo hoisting config',
    };
  }

  return {
    name: 'cssinjs-duplicate',
    status: 'pass',
    message: 'No duplicate @ant-design/cssinjs installations detected',
  };
}

function checkCssinjsCompat(ctx: DoctorContext): CheckResult {
  const range = ctx.antdPkg?.peerDependencies?.['@ant-design/cssinjs'];

  if (!ctx.antdPkg || !range) {
    return {
      name: 'cssinjs-compat',
      status: 'pass',
      message: 'No @ant-design/cssinjs peer dependency required by this antd version',
    };
  }

  if (!ctx.cssinjsPkg) {
    return {
      name: 'cssinjs-compat',
      status: 'warn',
      severity: 'warning',
      message: `antd ${ctx.antdPkg.version} requires @ant-design/cssinjs but it is not installed`,
      suggestion: 'Run `npm install @ant-design/cssinjs`',
    };
  }

  if (!satisfies(ctx.cssinjsPkg.version, range)) {
    return {
      name: 'cssinjs-compat',
      status: 'fail',
      severity: 'error',
      message: `@ant-design/cssinjs ${ctx.cssinjsPkg.version} is not compatible with antd ${ctx.antdPkg.version} (requires ${range})`,
      suggestion: `Run \`npm install @ant-design/cssinjs\` (requires ${range})`,
    };
  }

  return {
    name: 'cssinjs-compat',
    status: 'pass',
    message: `@ant-design/cssinjs ${ctx.cssinjsPkg.version} is compatible with antd ${ctx.antdPkg.version}`,
  };
}

function checkIconsCompat(ctx: DoctorContext): CheckResult {
  const range = ctx.antdPkg?.peerDependencies?.['@ant-design/icons'];

  if (!ctx.antdPkg || !range) {
    return {
      name: 'icons-compat',
      status: 'pass',
      message: 'No @ant-design/icons peer dependency declared',
    };
  }

  if (!ctx.iconsPkg) {
    return {
      name: 'icons-compat',
      status: 'pass',
      message: '@ant-design/icons is not installed (optional)',
    };
  }

  if (!satisfies(ctx.iconsPkg.version, range)) {
    return {
      name: 'icons-compat',
      status: 'warn',
      severity: 'warning',
      message: `@ant-design/icons ${ctx.iconsPkg.version} may not be compatible with antd ${ctx.antdPkg.version} (requires ${range})`,
      suggestion: `Run \`npm install @ant-design/icons\` (requires ${range})`,
    };
  }

  return {
    name: 'icons-compat',
    status: 'pass',
    message: `@ant-design/icons ${ctx.iconsPkg.version} is compatible with antd ${ctx.antdPkg.version}`,
  };
}

function checkCssInJs(ctx: DoctorContext): CheckResult {
  if (!ctx.cssinjsPkg) {
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

function checkEcosystemPeerDeps(ctx: DoctorContext): CheckResult[] {
  return ctx.ecosystemPackages.map((pkg) => {
    const failures: string[] = [];  // installed but version doesn't satisfy range
    const warnings: string[] = [];  // not installed at all
    const failureSuggestions: string[] = [];
    const warningSuggestions: string[] = [];

    for (const [dep, range] of Object.entries(pkg.peerDependencies)) {
      const installedVersion = getInstalledVersion(ctx.cwd, dep);

      if (installedVersion === null) {
        warnings.push(`${dep} is not installed (requires ${range})`);
        warningSuggestions.push(dep);
      } else if (!satisfies(installedVersion, range)) {
        failures.push(`${dep} requires ${range} (installed: ${installedVersion})`);
        failureSuggestions.push(`npm install ${dep}@"${range}"`);
      }
    }

    if (failures.length > 0) {
      const allIssues = [...failures, ...warnings].join('; ');
      const suggestionCmds = [...failureSuggestions];
      if (warningSuggestions.length > 0) {
        suggestionCmds.push(`npm install ${warningSuggestions.join(' ')}`);
      }
      return {
        name: `ecosystem-compat:${pkg.shortName}`,
        status: 'fail' as const,
        severity: 'error' as const,
        message: `${pkg.name} ${pkg.version} peerDep issues: ${allIssues}`,
        suggestion: `Run: ${suggestionCmds.join(' && ')}`,
      };
    }

    if (warnings.length > 0) {
      return {
        name: `ecosystem-compat:${pkg.shortName}`,
        status: 'warn' as const,
        severity: 'warning' as const,
        message: `${pkg.name} ${pkg.version} peerDep issues: ${warnings.join('; ')}`,
        suggestion: `Run \`npm install ${warningSuggestions.join(' ')}\``,
      };
    }

    return {
      name: `ecosystem-compat:${pkg.shortName}`,
      status: 'pass' as const,
      message: `${pkg.name} ${pkg.version} satisfies all peerDependencies`,
    };
  });
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
        checkDayjsDuplicate(ctx),
        checkCssinjsDuplicate(ctx),
        checkCssinjsCompat(ctx),
        checkIconsCompat(ctx),
        checkThemeConfig(ctx),
        checkBabelPlugins(ctx),
        checkCssInJs(ctx),
        ...checkEcosystemPeerDeps(ctx),
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
