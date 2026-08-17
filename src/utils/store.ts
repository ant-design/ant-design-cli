import Conf, { type Options } from 'conf';
import envPaths from 'env-paths';
import type { PackageManager } from './detect-pm.js';

const paths = envPaths('antd-cli');

const sharedConfig: Options<any> = {
  projectName: 'antd-cli',
  projectSuffix: ''
}

// ==========================================
// 1. User config store (stored in config dir)
// ==========================================
export interface AppConfig {
  packageManager?: PackageManager;
}

export const configStore = new Conf<AppConfig>({
  ...sharedConfig,
  cwd: paths.config,
  configName: 'config',
});

// ==========================================
// 2. Runtime cache store (stored in cache dir)
// ==========================================
export interface AppCache {
  updateCache?: {
    lastChecked: number;
    latestVersion: string;
  };
}

export const cacheStore = new Conf<AppCache>({
  ...sharedConfig,
  cwd: paths.cache,
  configName: 'cache',
});
