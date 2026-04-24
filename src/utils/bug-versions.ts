import { get } from 'node:https';
import { satisfies } from '../data/version.js';
import { cacheStore } from './store.js';

const BUG_VERSIONS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export type BugVersionsMap = Record<string, string[]>;

export interface BugMatchResult {
  range: string;
  urls: string[];
}

function fetchBugVersionsFromUrl(url: string): Promise<BugVersionsMap> {
  return new Promise((resolve, reject) => {
    const req = get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as BugVersionsMap);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchBugVersions(): Promise<BugVersionsMap | null> {
  const sources = [
    'https://registry.npmmirror.com/antd/latest/files/BUG_VERSIONS.json', // China mirror (fast in CN)
    'https://unpkg.com/antd/BUG_VERSIONS.json',                           // Unpkg CDN
    'https://cdn.jsdelivr.net/npm/antd/BUG_VERSIONS.json',                // jsDelivr CDN
  ];
  return Promise.any(sources.map((url) => fetchBugVersionsFromUrl(url))).catch(() => null);
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

  const fetched = await fetchBugVersions();

  if (fetched) {
    cacheStore.set('bugVersionsCache', { lastChecked: now, data: fetched });
    return fetched;
  }

  // Network failed — degrade gracefully to stale cache data
  return cached?.data ?? null;
}
