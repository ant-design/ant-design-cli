import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_DIR = join(homedir(), '.antd-cli', 'cache');

export function getCacheDir(): string {
  return CACHE_DIR;
}

export function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function readCache<T>(key: string): T | null {
  const filePath = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown): void {
  ensureCacheDir();
  const filePath = join(CACHE_DIR, `${key}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
