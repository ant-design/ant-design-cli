import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { updateVersionsJson } from '../../../scripts/sync.js';

describe('sync versions.json handling', () => {
  let workdir: string;
  let dataDir: string;

  beforeEach(() => {
    workdir = join(tmpdir(), `antd-cli-sync-versions-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    dataDir = join(workdir, 'data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'versions.json'), '{broken');
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('fails closed instead of overwriting a corrupted versions.json', () => {
    expect(() => updateVersionsJson(dataDir, 6, new Map([['6.4', '6.4.4']]))).toThrow(/versions\.json/);
    expect(readFileSync(join(dataDir, 'versions.json'), 'utf8')).toBe('{broken');
  });

  it('fails closed when versions.json parses to a non-object value', () => {
    writeFileSync(join(dataDir, 'versions.json'), 'null');

    expect(() => updateVersionsJson(dataDir, 6, new Map([['6.4', '6.4.4']]))).toThrow(/versions\.json/);
    expect(readFileSync(join(dataDir, 'versions.json'), 'utf8')).toBe('null');
  });
});
