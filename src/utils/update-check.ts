import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { get } from 'node:https';
import { compare, valid } from '../data/version.js';

declare const __CLI_VERSION__: string;

interface UpdateCache {
  lastChecked: number;
  latestVersion: string;
}

const CACHE_DIR = join(homedir(), '.config', 'antd-cli');
const CACHE_FILE = join(CACHE_DIR, 'update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readCache(): UpdateCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as UpdateCache;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8');
  } catch {
    // ignore write errors
  }
}

function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = get(
      'https://registry.npmjs.org/@ant-design/cli/latest',
      { timeout: 3000 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data) as { version?: string };
            resolve(json.version ?? null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function printUpdateNotice(currentVersion: string, latestVersion: string): void {
  const line = `  Update available: ${currentVersion} → ${latestVersion}  `;
  const install = '  Run: npm i -g @ant-design/cli  ';
  const width = Math.max(line.length, install.length);
  const pad = (s: string) => s + ' '.repeat(width - s.length);
  const bar = '─'.repeat(width);

  process.stderr.write(`\n╭${bar}╮\n`);
  process.stderr.write(`│${pad(line)}│\n`);
  process.stderr.write(`│${pad(install)}│\n`);
  process.stderr.write(`╰${bar}╯\n`);
}

export async function checkForUpdate(): Promise<void> {
  // Skip in CI or when explicitly disabled
  if (process.env.CI || process.env.NO_UPDATE_CHECK) return;

  const currentVersion = __CLI_VERSION__;
  if (!valid(currentVersion)) return;

  const now = Date.now();
  const cache = readCache();

  let latestVersion = cache?.latestVersion ?? null;

  // Fetch if no cache or cache is stale
  if (!cache || now - cache.lastChecked > CHECK_INTERVAL_MS) {
    const fetched = await fetchLatestVersion();
    writeCache({
      lastChecked: now,
      latestVersion: fetched ?? latestVersion ?? currentVersion,
    });
    if (fetched) latestVersion = fetched;
  }

  if (latestVersion && valid(latestVersion) && compare(currentVersion, latestVersion) < 0) {
    printUpdateNotice(currentVersion, latestVersion);
  }
}
