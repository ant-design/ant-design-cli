import { get } from 'node:https';
import { compare, valid } from '../data/version.js';
import { cacheStore } from './store.js';

declare const __CLI_VERSION__: string;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function fetchVersionFromUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = get(url, { timeout: 3000 }, (res) => {
      // Handle unpkg 302 redirect quickly without downloading body
      if (res.statusCode === 302 && res.headers.location) {
        const match = res.headers.location.match(/@ant-design\/cli@([^/]+)/);
        if (match && match[1]) {
          resolve(match[1]);
          return;
        }
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data) as { version?: string };
          if (json.version) resolve(json.version);
          else reject(new Error('No version provided'));
        } catch (err) {
          reject(err);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function fetchLatestVersion(): Promise<string | null> {
  const sources = [
    'https://registry.npmjs.org/@ant-design/cli/latest', // Official npm
    'https://registry.npmmirror.com/@ant-design/cli/latest', // China mirror
    'https://unpkg.com/@ant-design/cli@latest/package.json', // Unpkg CDN
  ];

  // Return the fastest successful result. If all fail, return null.
  return Promise.any(sources.map((url) => fetchVersionFromUrl(url))).catch(() => null);
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
