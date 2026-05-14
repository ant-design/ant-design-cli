import { readFileSync } from 'node:fs';

/**
 * Read and parse a JSON file, returning null on failure.
 */
export function readJson<T = unknown>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}