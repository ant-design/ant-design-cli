import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateVersionsIndexReferences } from '../../../scripts/validate-data.js';

describe('validate data versions index', () => {
  let workdir: string;
  let dataDir: string;

  beforeEach(() => {
    workdir = join(tmpdir(), `antd-cli-validate-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    dataDir = join(workdir, 'data');
    mkdirSync(dataDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('reports versions.json entries that point to missing snapshots', () => {
    writeFileSync(join(dataDir, 'versions.json'), JSON.stringify({ v6: { '6.4': '6.4.4' } }));
    writeFileSync(join(dataDir, 'v6.json'), JSON.stringify({
      version: '6.4.4',
      majorVersion: '6',
      components: [{ name: 'Button', props: [] }],
    }));

    expect(validateVersionsIndexReferences(dataDir)).toEqual([
      'versions.json references missing snapshot data/v6.4.4.json',
    ]);
  });
});
