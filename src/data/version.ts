import { existsSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { readJson, type PackageJson } from '../utils/json.js';

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
    // Try parse first to preserve prerelease tags (e.g. "5.0.0-beta.1"),
    // then fall back to coerce for partial versions (e.g. "5" → "5.0.0")
    const parsed = semver.parse(flagVersion) ?? semver.coerce(flagVersion);
    if (parsed) {
      return {
        version: parsed.version,
        majorVersion: `v${parsed.major}`,
        source: 'flag',
      };
    }
    // Non-semver flag value — fall through with a warning
    process.stderr.write(`[antd-cli] Warning: --version "${flagVersion}" is not a valid semver version; falling back to auto-detection.\n`);
  }

  // 2. node_modules/antd/package.json
  const nmPath = join(process.cwd(), 'node_modules', 'antd', 'package.json');
  if (existsSync(nmPath)) {
    const pkg = readJson<PackageJson>(nmPath);
    if (pkg?.version) {
      return {
        version: pkg.version,
        majorVersion: toMajor(pkg.version),
        source: 'node_modules',
      };
    }
  }

  // 3. Project package.json dependencies
  const pkgPath = join(process.cwd(), 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = readJson<{
      dependencies?: { antd?: string };
      devDependencies?: { antd?: string };
      peerDependencies?: { antd?: string };
    }>(pkgPath);
    const depVersion =
      pkg?.dependencies?.antd || pkg?.devDependencies?.antd || pkg?.peerDependencies?.antd;
    if (depVersion) {
      // Try parse first to preserve prerelease, then coerce for partial versions
      const parsed = semver.parse(depVersion) ?? semver.coerce(depVersion);
      if (parsed) {
        return {
          version: parsed.version,
          majorVersion: `v${parsed.major}`,
          source: 'package.json',
        };
      }
      // Non-semver specifier (e.g. '*', 'workspace:*', 'npm:antd@5.0.0')
      // Fall through to fallback
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

/** Semver comparison using the `semver` package. Returns -1, 0, or 1, or null if either version is unparseable. */
export function compare(a: string, b: string): number | null {
  const sa = semver.coerce(a);
  const sb = semver.coerce(b);
  if (!sa || !sb) return null;
  return semver.compare(sa, sb);
}

/** Check if a string is a valid semver version. */
export function valid(version: string): boolean {
  return semver.valid(version) !== null;
}

/** Check if a version satisfies a semver range. */
export function satisfies(version: string, range: string): boolean {
  return semver.satisfies(version, range, { includePrerelease: true }) ?? false;
}