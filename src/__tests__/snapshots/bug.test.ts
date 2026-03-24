import { describe, it, expect } from 'vitest';
import { run, runStderr, formats } from '../snapshot-helper.js';

/**
 * Normalize environment-specific values so snapshots are stable across machines.
 * Replaces OS info (e.g. "darwin 24.6.0", "linux 6.14.0-1017-azure") and
 * Node version (e.g. "v22.22.0") with fixed placeholders.
 */
function normalizeEnv(s: string): string {
  return s
    .replace(/\b(darwin|linux|win32)[\s+]+[\w.\-]+/g, '<system>')
    .replace(/v\d+\.\d+\.\d+/g, '<node-version>')
    .replace(/\d+\.\d+\.\d+/g, '<version>');
}

describe('bug', () => {
  for (const format of formats) {
    it(`bug --title Test --format ${format}`, () => {
      expect(normalizeEnv(run('bug', '--title', 'Test', '--format', format))).toMatchSnapshot();
    });
  }

  it('bug --title Test --steps "Click" --expected "OK" --actual "Crash"', () => {
    expect(
      normalizeEnv(run('bug', '--title', 'Test', '--steps', 'Click', '--expected', 'OK', '--actual', 'Crash')),
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
      expect(normalizeEnv(run('bug-cli', '--title', 'Test', '--format', format))).toMatchSnapshot();
    });
  }

  it('bug-cli --title Test --description "Info crashes"', () => {
    expect(
      normalizeEnv(run('bug-cli', '--title', 'Test', '--description', 'Info crashes')),
    ).toMatchSnapshot();
  });
});
