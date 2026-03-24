import { describe, it, expect } from 'vitest';
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

  // --apply
  it('migrate 4 5 --apply /tmp', () => {
    expect(run('migrate', '4', '5', '--apply', '/tmp')).toMatchSnapshot();
  });

  it('migrate 4 5 --apply /tmp --format json', () => {
    expect(run('migrate', '4', '5', '--apply', '/tmp', '--format', 'json')).toMatchSnapshot();
  });

  // error: invalid path
  it('migrate 3 6 (invalid)', () => {
    expect(runStderr('migrate', '3', '6')).toMatchSnapshot();
  });
});
