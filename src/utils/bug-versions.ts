import { satisfies } from '../data/version.js';
import { cacheStore } from './store.js';
import { fetchFirstJson } from './fetch.js';

const BUG_VERSIONS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export type BugVersionsMap = Record<string, string[]>;

export interface BugMatchResult {
  range: string;
  urls: string[];
}

const BUG_VERSIONS_SOURCES = [
  'https://registry.npmmirror.com/antd/latest/files/BUG_VERSIONS.json', // China mirror (fast in CN)
  'https://unpkg.com/antd/BUG_VERSIONS.json',                           // Unpkg CDN
  'https://cdn.jsdelivr.net/npm/antd/BUG_VERSIONS.json',                // jsDelivr CDN
];

/** Find the first bug range that the given antd version matches. */
export function findBugInfo(version: string, bugVersions: BugVersionsMap): BugMatchResult | null {
  for (const [range, urls] of Object.entries(bugVersions)) {
    if (satisfies(version, range)) {
      return { range, urls };
    }
  }
  return null;
}

/**
 * Get BUG_VERSIONS data using a 6-hour cache.
 * Falls back to stale cache on network failure.
 * Returns null only if never cached and all fetches fail.
 */
export async function getBugVersions(): Promise<BugVersionsMap | null> {
  const now = Date.now();
  const cached = cacheStore.get('bugVersionsCache');

  if (cached && now - cached.lastChecked < BUG_VERSIONS_TTL_MS) {
    return cached.data;
  }

  const fetched = await fetchFirstJson<BugVersionsMap>(BUG_VERSIONS_SOURCES, 5000);

  if (fetched) {
    cacheStore.set('bugVersionsCache', { lastChecked: now, data: fetched });
    return fetched;
  }

  // Network failed — degrade gracefully to stale cache data
  return cached?.data ?? null;
}