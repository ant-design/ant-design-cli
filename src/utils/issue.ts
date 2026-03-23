import { platform, release } from 'node:os';
import { readJson } from './scan.js';
import { join } from 'node:path';

declare const __CLI_VERSION__: string;

export interface AntdEnv {
  antd: string;
  react: string;
  system: string;
  browser: string;
}

export interface CliEnv {
  cli: string;
  node: string;
  system: string;
}

function getSystem(): string {
  return `${platform()} ${release()}`;
}

export function collectAntdEnv(cwd: string, versionOverride?: string): AntdEnv {
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const reactPkg = readJson(join(cwd, 'node_modules', 'react', 'package.json'));

  return {
    antd: versionOverride || antdPkg?.version || 'unknown',
    react: reactPkg?.version || 'unknown',
    system: getSystem(),
    browser: '-',
  };
}

export function collectCliEnv(): CliEnv {
  let cliVersion: string;
  try {
    cliVersion = __CLI_VERSION__;
  } catch {
    cliVersion = 'unknown';
  }
  return {
    cli: cliVersion,
    node: process.version,
    system: getSystem(),
  };
}
