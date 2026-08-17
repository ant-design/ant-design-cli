import { execFileSync } from 'node:child_process';

export const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm', 'bun', 'cnpm', 'utoo'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

interface PMRule {
  pm: PackageManager;
  keywords: string[];
}

const PM_RULES: PMRule[] = [
  { pm: 'utoo', keywords: ['.utoo', 'utoo/global'] },
  { pm: 'cnpm', keywords: ['.cnpm', 'cnpm/global'] },
  {
    pm: 'yarn',
    keywords: ['yarn/global', '/.yarn/bin/', '/yarn/bin/', '/yarn/data/global/', '/yarn/config/global/'],
  },
  { pm: 'pnpm', keywords: ['.pnpm-global', 'pnpm/global', '/pnpm/'] },
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

export function isPackageManager(value: unknown): value is PackageManager {
  return typeof value === 'string' && PACKAGE_MANAGERS.includes(value as PackageManager);
}

export function inferPackageManagerFromPath(binPath: string): PackageManager {
  const normalized = binPath.replace(/\\/g, '/').toLowerCase();
  for (const rule of PM_RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) return rule.pm;
    }
  }
  return 'npm';
}

function isAntdCliPath(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, '/').toLowerCase();
  const fileName = normalized.split('/').pop();
  return fileName === 'antd'
    || fileName === 'antd.cmd'
    || fileName === 'antd.exe'
    || normalized.endsWith('/@ant-design/cli/dist/index.js');
}

export function findAntdBinaryPath(invocationPath: string | undefined = process.argv[1]): string | null {
  if (invocationPath && isAntdCliPath(invocationPath)) {
    return invocationPath;
  }

  const isWin = process.platform === 'win32';
  try {
    const binPath = execFileSync(isWin ? 'where' : 'which', ['antd'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    if (!binPath) return null;
    // Take first line in case of multiple matches
    return binPath.split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

export function detectPackageManager(): PackageManager | null {
  const binPath = findAntdBinaryPath();
  return binPath ? inferPackageManagerFromPath(binPath) : null;
}
