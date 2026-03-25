import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MetadataStore, ComponentData, CLIError } from '../types.js';
import { createError, fuzzyMatch, ErrorCodes } from '../output/error.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedDataPath: string | undefined;

function getDataPath(): string {
  if (cachedDataPath) return cachedDataPath;
  // Check for a known file to confirm the correct directory
  // Works from both dist/ and src/data/
  // Probe for both .json.gz (published package) and .json (local dev) formats
  const candidates = [
    join(__dirname, '..', 'data'),       // from dist/
    join(__dirname, '..', '..', 'data'), // from src/data/
  ];
  cachedDataPath = candidates.find((p) =>
    existsSync(join(p, 'v5.json.gz')) || existsSync(join(p, 'v5.json'))
  ) ?? candidates[0];
  return cachedDataPath;
}

/** Read a JSON data file, supporting both .json.gz and plain .json formats. */
function readDataFile(filePath: string): string {
  const gzPath = filePath + '.gz';
  if (existsSync(gzPath)) {
    return gunzipSync(readFileSync(gzPath)).toString('utf-8');
  }
  return readFileSync(filePath, 'utf-8');
}

/** Deduplicate props by name (keep first occurrence). */
function normalizeStore(store: MetadataStore): MetadataStore {
  for (const comp of store.components) {
    const seen = new Set<string>();
    comp.props = comp.props.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }
  return store;
}

export function loadMetadata(majorVersion: string): MetadataStore {
  const dataPath = join(getDataPath(), `${majorVersion}.json`);
  try {
    return normalizeStore(JSON.parse(readDataFile(dataPath)) as MetadataStore);
  } catch (err) {
    if (err instanceof SyntaxError) {
      process.stderr.write(`[antd-cli] Warning: data file may be corrupted: ${dataPath}\n`);
    }
    return {
      version: majorVersion,
      majorVersion,
      components: [],
    };
  }
}

/**
 * Load metadata for the most accurate historical snapshot matching the given full semver version.
 *
 * Resolution order:
 * 1. Exact minor match in versions.json  (e.g. "4.3" → "4.3.4" → data/v4.3.4.json)
 * 2. Nearest earlier minor               (e.g. requested 4.2.5 but only 4.1.x exists → use 4.1.x)
 * 3. Fall back to loadMetadata(majorVersion) (i.e. data/v4.json)
 */
const metadataCache = new Map<string, MetadataStore>();

export function loadMetadataForVersion(version: string): MetadataStore {
  const cached = metadataCache.get(version);
  if (cached) return cached;

  const result = loadMetadataForVersionUncached(version);
  metadataCache.set(version, result);
  return result;
}

function loadMetadataForVersionUncached(version: string): MetadataStore {
  const parts = version.split('.');
  const major = parts[0];
  const majorVersion = `v${major}`;

  // If not a recognisable major.minor.patch string, fall back immediately
  if (!parts[1]) {
    return loadMetadata(majorVersion);
  }

  const minorKey = `${major}.${parts[1]}`; // e.g. "4.3"

  // Load versions index
  const versionsPath = join(getDataPath(), 'versions.json');
  let versionsIndex: Record<string, Record<string, string>> = {};
  try {
    versionsIndex = JSON.parse(readFileSync(versionsPath, 'utf-8'));
  } catch {
    return loadMetadata(majorVersion);
  }

  const majorIndex = versionsIndex[majorVersion] ?? {};

  // Helper: try to load a snapshot by tag string (e.g. "4.3.4")
  function tryLoadSnapshot(tag: string): MetadataStore | null {
    const snapshotPath = join(getDataPath(), `v${tag}.json`);
    if (!existsSync(snapshotPath) && !existsSync(snapshotPath + '.gz')) return null;
    try {
      return normalizeStore(JSON.parse(readDataFile(snapshotPath)) as MetadataStore);
    } catch {
      return null;
    }
  }

  // 1. Exact minor match
  if (majorIndex[minorKey]) {
    const result = tryLoadSnapshot(majorIndex[minorKey]);
    if (result) return result;
  }

  // 2. Nearest earlier minor
  const requestedMinor = parseInt(parts[1], 10);
  const availableMinors = Object.keys(majorIndex)
    .filter((k) => k.startsWith(`${major}.`))
    .sort((a, b) => parseInt(a.split('.')[1], 10) - parseInt(b.split('.')[1], 10));

  let bestMinorKey: string | undefined;
  for (const m of availableMinors) {
    if (parseInt(m.split('.')[1], 10) <= requestedMinor) {
      bestMinorKey = m;
    }
  }

  if (bestMinorKey && majorIndex[bestMinorKey]) {
    const result = tryLoadSnapshot(majorIndex[bestMinorKey]);
    if (result) return result;
  }

  // 3. Fall back to latest major snapshot
  return loadMetadata(majorVersion);
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

/**
 * Load metadata for a version, find a component, and return both.
 * Returns CLIError with fuzzy-match suggestion if the component is not found.
 */
export function resolveComponent(
  component: string,
  version: string,
): { store: MetadataStore; comp: ComponentData } | CLIError {
  const store = loadMetadataForVersion(version);
  const comp = findComponent(store, component);
  if (!comp) {
    const names = getAllComponentNames(store);
    const suggestion = fuzzyMatch(component, names);
    return createError(
      ErrorCodes.COMPONENT_NOT_FOUND,
      `Component '${component}' not found`,
      suggestion ? `Did you mean '${suggestion}'?` : undefined,
    );
  }
  return { store, comp };
}
