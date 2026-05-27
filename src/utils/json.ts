import { readFileSync } from 'node:fs';

/** Minimal package.json shape for versioned packages. */
export interface PackageJson {
  version?: string;
}

/**
 * Read and parse a JSON file, returning null on failure.
 * Returns { missing: true } when the file does not exist, to distinguish
 * ENOENT from other failures such as malformed JSON.
 */
export function readJson<T = unknown>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch (err) {
    return null;
  }
}

/**
 * Like readJson, but returns a discriminated result so callers can tell
 * whether the file was missing vs corrupted.
 */
export function readJsonWithStatus<T = unknown>(path: string): { data: T; missing: false } | { data: null; missing: boolean } {
  try {
    return { data: JSON.parse(readFileSync(path, 'utf-8')) as T, missing: false };
  } catch (err) {
    const isMissing = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
    return { data: null, missing: isMissing };
  }
}