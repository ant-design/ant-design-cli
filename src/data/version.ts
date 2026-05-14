import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';

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

/** Semver comparison. Returns -1, 0, or 1. */
export function compare(a: string, b: string): number {
  const sa = semver.coerce(a);
  const sb = semver.coerce(b);
  if (!sa || !sb) return 0;
  return semver.compare(sa, sb);
}

/** Check if a string is a valid semver version. */
export function valid(version: string): boolean {
  return semver.valid(version) !== null;
}

/** Check if a version satisfies a semver range. Delegates to the `semver` package. */
export function satisfies(version: string, range: string): boolean {
  return semver.satisfies(version, range) ?? true;
}