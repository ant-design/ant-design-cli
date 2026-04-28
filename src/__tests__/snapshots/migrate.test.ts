import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { run, runStderr, formats } from '../snapshot-helper.js';

describe('migrate', () => {
  // v4 → v5
  for (const format of formats) {
    it(`migrate 4 5 --format ${format}`, () => {
      expect(run('migrate', '4', '5', '--format', format)).toMatchSnapshot();
    });
  }

  // v5 → v6
  for (const format of formats) {
    it(`migrate 5 6 --format ${format}`, () => {
      expect(run('migrate', '5', '6', '--format', format)).toMatchSnapshot();
    });
  }

  // --component filter
  it('migrate 4 5 --component Select', () => {
    expect(run('migrate', '4', '5', '--component', 'Select')).toMatchSnapshot();
  });

  it('migrate 4 5 --component Select --format json', () => {
    expect(run('migrate', '4', '5', '--component', 'Select', '--format', 'json')).toMatchSnapshot();
  });

  // --apply (uses a controlled temp directory for deterministic snapshots)
  const applyDir = join(tmpdir(), 'antd-migrate-snapshot-test');
  beforeAll(() => {
    mkdirSync(applyDir, { recursive: true });
    writeFileSync(join(applyDir, 'App.tsx'), `import { Modal, Button, Select } from 'antd';
<Modal visible={show} onCancel={onClose}>Content</Modal>
<Select dropdownClassName="my-dropdown" />
<Button type="primary">Submit</Button>
`);
    writeFileSync(join(applyDir, 'utils.ts'), `// no antd usage here\n`);
  });
  afterAll(() => {
    rmSync(applyDir, { recursive: true, force: true });
  });

  it('migrate 4 5 --apply <dir>', () => {
    expect(run('migrate', '4', '5', '--apply', applyDir)).toMatchSnapshot();
  });

  it('migrate 4 5 --apply <dir> --format json', () => {
    expect(run('migrate', '4', '5', '--apply', applyDir, '--format', 'json')).toMatchSnapshot();
  });

  // error: invalid path
  it('migrate 3 6 (invalid)', () => {
    expect(runStderr('migrate', '3', '6')).toMatchSnapshot();
  });
});
