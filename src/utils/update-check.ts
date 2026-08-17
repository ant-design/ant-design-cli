import { compare, valid } from '../data/version.js';
import stringWidth from 'string-width';
import { cacheStore } from './store.js';
import { fetchFirstJson } from './fetch.js';
import { findAntdBinaryPath, inferPackageManagerFromPath, UPGRADE_COMMANDS } from './detect-pm.js';

declare const __CLI_VERSION__: string;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const NPM_SOURCES = [
  'https://registry.npmjs.org/@ant-design/cli/latest', // Official npm
  'https://registry.npmmirror.com/@ant-design/cli/latest', // China mirror
  'https://unpkg.com/@ant-design/cli@latest/package.json', // Unpkg CDN
];

export async function fetchLatestVersion(): Promise<string | null> {
  const json = await fetchFirstJson<{ version?: string }>(NPM_SOURCES, 3000);
  return json?.version ?? null;
}

function printUpdateNotice(currentVersion: string, latestVersion: string): void {
  const line = `  Update available: ${currentVersion} → ${latestVersion}  `;
  const binPath = findAntdBinaryPath();
  const packageManager = binPath ? inferPackageManagerFromPath(binPath) : 'npm';
  const upgrade = UPGRADE_COMMANDS[packageManager];
  const running = binPath ? `  Running: ${binPath}  ` : null;
  const cmd = '  Run: antd upgrade  ';
  const install = `  Or: ${upgrade.cmd} ${upgrade.args.join(' ')}  `;
  const lines = [line, running, cmd, install].filter((item): item is string => item !== null);
  const width = Math.max(...lines.map((item) => stringWidth(item)));
  const pad = (s: string) => s + ' '.repeat(width - stringWidth(s));
  const bar = '─'.repeat(width);

  process.stderr.write(`\n╭${bar}╮\n`);
  for (const item of lines) {
    process.stderr.write(`│${pad(item)}│\n`);
  }
  process.stderr.write(`╰${bar}╯\n`);
}

export async function checkForUpdate(): Promise<void> {
  // Skip in CI or when explicitly disabled
  if (process.env.CI || process.env.NO_UPDATE_CHECK) return;

  const currentVersion = __CLI_VERSION__;
  /* v8 ignore next -- __CLI_VERSION__ is a tsup-injected compile-time constant always a valid semver */
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

  if (latestVersion && valid(latestVersion) && (compare(currentVersion, latestVersion) ?? 0) < 0) {
    printUpdateNotice(currentVersion, latestVersion);
  }
}
