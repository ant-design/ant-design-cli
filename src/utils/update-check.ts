import { compare, valid } from '../data/version.js';
import { cacheStore } from './store.js';

declare const __CLI_VERSION__: string;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchVersionFromUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { version?: string };
    if (json.version) return json.version;
    throw new Error('No version provided');
  } finally {
    clearTimeout(timer);
  }
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
