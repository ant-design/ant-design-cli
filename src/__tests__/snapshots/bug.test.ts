import { describe, it, expect } from 'vitest';
import { run, runStderr, formats } from '../snapshot-helper.js';

describe('bug', () => {
  for (const format of formats) {
    it(`bug --title Test --format ${format}`, () => {
      expect(run('bug', '--title', 'Test', '--format', format)).toMatchSnapshot();
    });
  }

  it('bug --title Test --steps "Click" --expected "OK" --actual "Crash"', () => {
    expect(
      run('bug', '--title', 'Test', '--steps', 'Click', '--expected', 'OK', '--actual', 'Crash'),
    ).toMatchSnapshot();
  });

  // error: no title
  it('bug (no title)', () => {
    expect(runStderr('bug')).toMatchSnapshot();
  });

  it('bug --format json (no title)', () => {
    expect(runStderr('bug', '--format', 'json')).toMatchSnapshot();
  });
});

describe('bug-cli', () => {
  for (const format of formats) {
    it(`bug-cli --title Test --format ${format}`, () => {
      expect(run('bug-cli', '--title', 'Test', '--format', format)).toMatchSnapshot();
    });
  }

  it('bug-cli --title Test --description "Info crashes"', () => {
    expect(
      run('bug-cli', '--title', 'Test', '--description', 'Info crashes'),
    ).toMatchSnapshot();
  });
});
