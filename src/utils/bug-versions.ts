import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { satisfies } from '../data/version.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type BugVersionsMap = Record<string, string[]>;

export interface BugMatchResult {
  range: string;
  urls: string[];
}

let bundledBugVersions: BugVersionsMap | null | undefined;

function readDataFile(filePath: string): string {
  const gzPath = filePath + '.gz';
  /* v8 ignore next 3 -- gz files only present in production builds */
  if (existsSync(gzPath)) {
    return gunzipSync(readFileSync(gzPath)).toString('utf-8');
  }
  return readFileSync(filePath, 'utf-8');
}

/** Load bundled BUG_VERSIONS data without network or runtime cache access. */
export function loadBundledBugVersions(): BugVersionsMap | null {
  if (bundledBugVersions !== undefined) return bundledBugVersions;

  const candidates = [
    join(__dirname, '..', 'data', 'bug-versions.json'),       // from dist/
    join(__dirname, '..', '..', 'data', 'bug-versions.json'), // from src/utils/
  ];

  for (const filePath of candidates) {
    try {
      if (!existsSync(filePath) && !existsSync(filePath + '.gz')) continue;
      bundledBugVersions = JSON.parse(readDataFile(filePath)) as BugVersionsMap;
      return bundledBugVersions;
    } catch {
      // Try the next candidate.
    }
  }

  /* v8 ignore start -- defensive: bundled data/ is always present */
  bundledBugVersions = null;
  return bundledBugVersions;
  /* v8 ignore stop */
}

/** Find the first bug range that the given antd version matches. */
export function findBugInfo(version: string, bugVersions: BugVersionsMap): BugMatchResult | null {
  for (const [range, urls] of Object.entries(bugVersions)) {
    if (satisfies(version, range)) {
      return { range, urls };
    }
  }
  return null;
}
