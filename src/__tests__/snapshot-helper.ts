import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const CLI = join(__dirname, '..', '..', 'dist', 'index.js');

export const formats = ['text', 'json', 'markdown'] as const;
export const langs = ['en', 'zh'] as const;

const env = { ...process.env, NO_UPDATE_CHECK: '1' };

export function run(...args: string[]): string {
  return execFileSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 10000,
    env,
  }).trim();
}

export function runStderr(...args: string[]): string {
  try {
    execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    return '';
  } catch (err: any) {
    return (err.stderr || '').trim();
  }
}
