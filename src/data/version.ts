import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { readJson, type PackageJson } from '../utils/json.js';

export interface VersionInfo {
  version: string;
  majorVersion: string;
  source: 'flag' | 'node_modules' | 'package.json' | 'fallback';
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Last-resort fallback if the bundled data can't be probed (should never happen
// in a real install). The dynamic resolver below normally supersedes this.
const SAFE_FALLBACK_VERSION = '6.0.0';
const SAFE_FALLBACK_MAJOR = 'v6';

/** Read a major snapshot's `version`, supporting both .json (dev) and .json.gz (published). */
function readSnapshotVersion(dir: string, major: string): string | undefined {
  const base = join(dir, `${major}.json`);
  try {
    if (existsSync(base)) {
      return (JSON.parse(readFileSync(base, 'utf-8')) as PackageJson).version;
    }
    /* v8 ignore next 3 -- gz files only present in production builds */
    if (existsSync(base + '.gz')) {
      return (JSON.parse(gunzipSync(readFileSync(base + '.gz')).toString('utf-8')) as PackageJson).version;
    }
    /* v8 ignore next 3 -- defensive: bundled snapshots are always valid */
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Resolve the fallback version dynamically from the bundled data: the highest
 * major snapshot present (e.g. data/v6.json[.gz]) and its `version` field. This
 * keeps the fallback aligned with "latest" as new majors are synced, instead of
 * a hardcoded constant that silently goes stale (it was stuck at 5.24.0 long
 * after v6 shipped). Memoized — the bundled data never changes at runtime.
 */
let cachedFallback: { version: string; majorVersion: string } | undefined;

function resolveFallback(): { version: string; majorVersion: string } {
  if (cachedFallback) return cachedFallback;

  // Mirror loader.ts: data/ sits next to dist/ (published) or one level up (src/data/)
  const candidates = [join(__dirname, '..', 'data'), join(__dirname, '..', '..', 'data')];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    let best = 0;
    for (const file of readdirSync(dir)) {
      const m = file.match(/^v(\d+)\.json(?:\.gz)?$/);
      if (m) best = Math.max(best, parseInt(m[1], 10));
    }
    if (best === 0) continue;

    const major = `v${best}`;
    cachedFallback = {
      version: readSnapshotVersion(dir, major) ?? `${best}.0.0`,
      majorVersion: major,
    };
    return cachedFallback;
  }

  /* v8 ignore next 2 -- defensive: bundled data/ is always present */
  cachedFallback = { version: SAFE_FALLBACK_VERSION, majorVersion: SAFE_FALLBACK_MAJOR };
  return cachedFallback;
}

export function detectVersion(flagVersion?: string): VersionInfo {
  // 1. --version flag
  if (flagVersion) {
    // Try parse first to preserve prerelease tags (e.g. "5.0.0-beta.1"),
    // then fall back to coerce for partial versions (e.g. "5" → "5.0.0")
    const parsed = semver.parse(flagVersion) ?? semver.coerce(flagVersion, { includePrerelease: true });
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
      const parsed = semver.parse(depVersion) ?? semver.coerce(depVersion, { includePrerelease: true });
      if (parsed) {
        return {
          version: parsed.version,
          majorVersion: `v${parsed.major}`,
          source: 'package.json',
        };
      }
      // Non-semver specifier (e.g. '*', 'workspace:*')
      // Note: 'npm:antd@5.0.0' is handled by coerce above, not here
      // Fall through to fallback
    }
  }

  // 4. Fallback to the latest bundled major
  const fb = resolveFallback();
  return {
    version: fb.version,
    majorVersion: fb.majorVersion,
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