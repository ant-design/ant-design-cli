import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCache, writeCache } from './cache.js';
import type { MetadataStore, ComponentData } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getSampleDataPath(): string {
  // Try multiple possible locations (works from both dist/ and src/data/)
  const candidates = [
    join(__dirname, '..', 'sample-data'),       // from dist/
    join(__dirname, '..', '..', 'sample-data'),  // from src/data/
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

export function loadMetadata(majorVersion: string, useCache: boolean): MetadataStore {
  const cacheKey = `metadata-${majorVersion}`;

  // Check cache first
  if (useCache) {
    const cached = readCache<MetadataStore>(cacheKey);
    if (cached) return cached;
  }

  // Fall back to bundled sample data
  const samplePath = join(getSampleDataPath(), `${majorVersion}.json`);
  try {
    const data: MetadataStore = JSON.parse(readFileSync(samplePath, 'utf-8'));
    if (useCache) {
      writeCache(cacheKey, data);
    }
    return data;
  } catch {
    // Return empty store if no data available
    return {
      version: majorVersion,
      majorVersion,
      components: [],
    };
  }
}

export function findComponent(
  store: MetadataStore,
  name: string,
): ComponentData | undefined {
  return store.components.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
}

export function getAllComponentNames(store: MetadataStore): string[] {
  return store.components.map((c) => c.name);
}
