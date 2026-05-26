import { execFileSync } from 'node:child_process';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'cnpm' | 'utoo';

interface PMRule {
  pm: PackageManager;
  keywords: string[];
}

const PM_RULES: PMRule[] = [
  { pm: 'utoo', keywords: ['.utoo', 'utoo/global'] },
  { pm: 'cnpm', keywords: ['.cnpm', 'cnpm/global'] },
  { pm: 'yarn', keywords: ['yarn/global'] },
  { pm: 'pnpm', keywords: ['.pnpm-global', 'pnpm/global'] },
  { pm: 'bun', keywords: ['.bun', 'bun/install/global'] },
];

export const UPGRADE_COMMANDS: Record<PackageManager, { cmd: string; args: string[] }> = {
  npm: { cmd: 'npm', args: ['install', '-g', '@ant-design/cli@latest'] },
  yarn: { cmd: 'yarn', args: ['global', 'add', '@ant-design/cli@latest'] },
  pnpm: { cmd: 'pnpm', args: ['add', '-g', '@ant-design/cli@latest'] },
  bun: { cmd: 'bun', args: ['add', '-g', '@ant-design/cli@latest'] },
  cnpm: { cmd: 'cnpm', args: ['install', '-g', '@ant-design/cli@latest'] },
  utoo: { cmd: 'ut', args: ['install', '-g', '@ant-design/cli@latest'] },
};

export function inferPackageManagerFromPath(binPath: string): PackageManager {
  const normalized = binPath.replace(/\\/g, '/');
  for (const rule of PM_RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) return rule.pm;
    }
  }
  return 'npm';
}

export function detectPackageManager(): PackageManager | null {
  const isWin = process.platform === 'win32';
  try {
    const binPath = execFileSync(isWin ? 'where' : 'which', ['antd'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    if (!binPath) return null;
    // Take first line in case of multiple matches
    const firstPath = binPath.split('\n')[0].trim();
    return inferPackageManagerFromPath(firstPath);
  } catch {
    return null;
  }
}