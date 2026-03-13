import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface VersionInfo {
  version: string;
  majorVersion: string;
  source: 'flag' | 'node_modules' | 'package.json' | 'fallback';
}

const FALLBACK_VERSION = '5.24.0';
const FALLBACK_MAJOR = 'v5';

export function detectVersion(flagVersion?: string): VersionInfo {
  // 1. --version flag
  if (flagVersion) {
    return {
      version: flagVersion,
      majorVersion: toMajor(flagVersion),
      source: 'flag',
    };
  }

  // 2. node_modules/antd/package.json
  const nmPath = join(process.cwd(), 'node_modules', 'antd', 'package.json');
  if (existsSync(nmPath)) {
    try {
      const pkg = JSON.parse(readFileSync(nmPath, 'utf-8'));
      if (pkg.version) {
        return {
          version: pkg.version,
          majorVersion: toMajor(pkg.version),
          source: 'node_modules',
        };
      }
    } catch {
      // ignore parse errors
    }
  }

  // 3. Project package.json dependencies
  const pkgPath = join(process.cwd(), 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const depVersion =
        pkg.dependencies?.antd || pkg.devDependencies?.antd || pkg.peerDependencies?.antd;
      if (depVersion) {
        const cleaned = depVersion.replace(/[\^~>=<\s]/g, '');
        return {
          version: cleaned,
          majorVersion: toMajor(cleaned),
          source: 'package.json',
        };
      }
    } catch {
      // ignore parse errors
    }
  }

  // 4. Fallback to latest
  return {
    version: FALLBACK_VERSION,
    majorVersion: FALLBACK_MAJOR,
    source: 'fallback',
  };
}

function toMajor(version: string): string {
  const major = version.split('.')[0];
  return `v${major}`;
}

/** Simple semver comparison. Returns -1, 0, or 1. */
export function compare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/** Check if a string looks like a valid semver. */
export function valid(version: string): boolean {
  return /^\d+\.\d+\.\d+/.test(version);
}
