import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MetadataStore, ComponentData } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getDataPath(): string {
  // Check for a known file to confirm the correct directory
  // Works from both dist/ and src/data/
  const probe = 'v5.json';
  const candidates = [
    join(__dirname, '..', 'data'),       // from dist/
    join(__dirname, '..', '..', 'data'), // from src/data/
  ];
  return candidates.find((p) => existsSync(join(p, probe))) ?? candidates[0];
}

export function loadMetadata(majorVersion: string): MetadataStore {
  const dataPath = join(getDataPath(), `${majorVersion}.json`);
  try {
    return JSON.parse(readFileSync(dataPath, 'utf-8')) as MetadataStore;
  } catch {
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
