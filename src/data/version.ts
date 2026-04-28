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

/**
 * Check if a version string satisfies a semver range.
 * Supports: >=, <=, >, <, ^, ~, exact x.y.z, bare x, bare x.y,
 * and compound ranges (multiple space-separated constraints ANDed, e.g. ">= 5.2.3 <= 5.3.0").
 * Returns true for unrecognized range formats (fail-open).
 */
export function satisfies(version: string, range: string): boolean {
  range = range.trim();
  version = version.trim();

  // Compound range: multiple constraints ANDed (e.g. ">= 5.2.3 <= 5.3.0", ">= 4.21.6 < 4.22.0")
  const constraints = range.match(/(?:>=|<=|>|<)\s*\d+[\d.]*/g);
  if (constraints && constraints.length > 1) {
    return constraints.every((c) => satisfies(version, c.trim()));
  }

  if (range.startsWith('<=')) {
    const bound = range.slice(2).trim();
    return compare(version, bound) <= 0;
  }
  if (range.startsWith('>=')) {
    const bound = range.slice(2).trim();
    return compare(version, bound) >= 0;
  }
  if (range.startsWith('<')) {
    const bound = range.slice(1).trim();
    return compare(version, bound) < 0;
  }
  if (range.startsWith('>')) {
    const bound = range.slice(1).trim();
    return compare(version, bound) > 0;
  }
  if (range.startsWith('^')) {
    const bound = range.slice(1).trim();
    const vParts = version.split('.').map(Number);
    const bParts = bound.split('.').map(Number);
    if (vParts[0] !== bParts[0]) return false;
    return compare(version, bound) >= 0;
  }
  if (range.startsWith('~')) {
    const bound = range.slice(1).trim();
    const vParts = version.split('.').map(Number);
    const bParts = bound.split('.').map(Number);
    if (vParts[0] !== bParts[0] || vParts[1] !== bParts[1]) return false;
    return compare(version, bound) >= 0;
  }
  // bare major (e.g. "5") or major.minor (e.g. "5.1")
  const parts = range.split('.');
  if (parts.length <= 2 && parts.every(p => /^\d+$/.test(p))) {
    const vParts = version.split('.').map(Number);
    const rParts = parts.map(Number);
    if (vParts[0] !== rParts[0]) return false;
    if (rParts.length === 2 && vParts[1] !== rParts[1]) return false;
    return true;
  }
  // exact version (x.y.z)
  if (/^\d+\.\d+\.\d+/.test(range)) {
    return compare(version, range) === 0;
  }
  // Unrecognized range — fail-open
  return true;
}
