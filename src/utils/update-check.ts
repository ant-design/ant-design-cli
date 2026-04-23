import { get } from 'node:https';
import { compare, valid } from '../data/version.js';
import { cacheStore } from './store.js';

declare const __CLI_VERSION__: string;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const cache = cacheStore.get('updateCache') ?? null;

  let latestVersion = cache?.latestVersion ?? null;

  // Fetch if no cache or cache is stale
  if (!cache || now - cache.lastChecked > CHECK_INTERVAL_MS) {
    const fetched = await fetchLatestVersion();
    cacheStore.set('updateCache', {
      lastChecked: now,
      latestVersion: fetched ?? latestVersion ?? currentVersion,
    });
    if (fetched) latestVersion = fetched;
  }

  if (latestVersion && valid(latestVersion) && compare(currentVersion, latestVersion) < 0) {
    printUpdateNotice(currentVersion, latestVersion);
  }
}
