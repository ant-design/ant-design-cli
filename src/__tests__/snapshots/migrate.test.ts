import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { run, runStderr, formats } from '../snapshot-helper.js';

// Use a fixed isolated directory instead of /tmp to avoid pollution from
// other projects that may exist in /tmp on the developer's machine.
// Use a path relative to cwd so snapshots are reproducible across machines.
const ISOLATED_TMP = join(import.meta.dirname, '__fixtures_apply_tmp__');
const RELATIVE_TMP = relative(process.cwd(), ISOLATED_TMP);

beforeAll(() => {
  mkdirSync(ISOLATED_TMP, { recursive: true });
});

afterAll(() => {
  rmSync(ISOLATED_TMP, { recursive: true, force: true });
});

describe('migrate', () => {
  // v4 → v5
  for (const format of formats) {
    it(`migrate 4 5 --format ${format}`, async () => {
      expect(await run('migrate', '4', '5', '--format', format)).toMatchSnapshot();
    });
  }

  // v5 → v6
  for (const format of formats) {
    it(`migrate 5 6 --format ${format}`, async () => {
      expect(await run('migrate', '5', '6', '--format', format)).toMatchSnapshot();
    });
  }

  // --component filter
  it('migrate 4 5 --component Select', async () => {
    expect(await run('migrate', '4', '5', '--component', 'Select')).toMatchSnapshot();
  });

  it('migrate 4 5 --component Select --format json', async () => {
    expect(await run('migrate', '4', '5', '--component', 'Select', '--format', 'json')).toMatchSnapshot();
  });

  // --apply (use isolated temp dir to avoid pollution from real projects in /tmp)
  it('migrate 4 5 --apply <temp dir>', async () => {
    expect(await run('migrate', '4', '5', '--apply', RELATIVE_TMP)).toMatchSnapshot();
  });

  it('migrate 4 5 --apply <temp dir> --format json', async () => {
    expect(await run('migrate', '4', '5', '--apply', RELATIVE_TMP, '--format', 'json')).toMatchSnapshot();
  });

  // error: invalid path
  it('migrate 3 6 (invalid)', async () => {
    expect(await runStderr('migrate', '3', '6')).toMatchSnapshot();
  });
});