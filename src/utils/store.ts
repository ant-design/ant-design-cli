import Conf, { type Options } from 'conf';
import envPaths from 'env-paths';

const paths = envPaths('antd-cli');

const sharedConfig: Options<any> = {
  projectName: 'antd-cli',
  projectSuffix: ''
}

// ==========================================
// 1. User config store (stored in config dir)
// ==========================================
export interface AppConfig {
  // Add other user preferences here
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
  bugVersionsCache?: {
    lastChecked: number;
    data: Record<string, string[]>;
  };
}

export const cacheStore = new Conf<AppCache>({
  ...sharedConfig,
  cwd: paths.cache,
  configName: 'cache',
});
