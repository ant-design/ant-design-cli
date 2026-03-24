import { describe, it, expect } from 'vitest';
import { run, runStderr, formats } from '../snapshot-helper.js';

describe('changelog', () => {
  // single version
  for (const format of formats) {
    it(`changelog 5.21.0 --format ${format}`, () => {
      expect(run('changelog', '5.21.0', '--format', format)).toMatchSnapshot();
    });
  }

  // range (using .. syntax)
  for (const format of formats) {
    it(`changelog 5.20.0..5.22.0 --format ${format}`, () => {
      expect(run('changelog', '5.20.0..5.22.0', '--format', format)).toMatchSnapshot();
    });
  }

  // diff mode (two args)
  for (const format of formats) {
    it(`changelog 5.20.0 5.22.0 --format ${format}`, () => {
      expect(run('changelog', '5.20.0', '5.22.0', '--format', format)).toMatchSnapshot();
    });
  }

  // error: version not found
  it('changelog 5.99.99', () => {
    expect(runStderr('changelog', '5.99.99')).toMatchSnapshot();
  });

  // error: from > to
  it('changelog 5.5.0 5.1.0 (from > to)', () => {
    expect(runStderr('changelog', '5.5.0', '5.1.0')).toMatchSnapshot();
  });
});
