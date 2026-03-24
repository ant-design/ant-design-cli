import { describe, it, expect } from 'vitest';
import { run, runStderr, formats, langs } from '../snapshot-helper.js';

describe('info', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`info Button --format ${format} --lang ${lang}`, () => {
        expect(run('info', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  for (const format of formats) {
    it(`info Button --detail --format ${format}`, () => {
      expect(run('info', 'Button', '--detail', '--format', format)).toMatchSnapshot();
    });
  }

  // case-insensitive
  it('info button (lowercase)', () => {
    expect(run('info', 'button')).toMatchSnapshot();
  });

  // error: typo
  it('info Btn (typo)', () => {
    expect(runStderr('info', 'Btn')).toMatchSnapshot();
  });

  it('info Btn --format json (typo, json)', () => {
    expect(runStderr('info', 'Btn', '--format', 'json')).toMatchSnapshot();
  });

  // error: not found
  it('info NonExistent', () => {
    expect(runStderr('info', 'NonExistent')).toMatchSnapshot();
  });

  it('info NonExistent --format json', () => {
    expect(runStderr('info', 'NonExistent', '--format', 'json')).toMatchSnapshot();
  });
});
