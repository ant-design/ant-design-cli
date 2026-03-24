import { describe, it, expect } from 'vitest';
import { run, runStderr, formats, langs } from '../snapshot-helper.js';

describe('demo', () => {
  // list demos for a component
  for (const format of formats) {
    for (const lang of langs) {
      it(`demo Button --format ${format} --lang ${lang}`, () => {
        expect(run('demo', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  // specific demo
  for (const format of formats) {
    it(`demo Button basic --format ${format}`, () => {
      expect(run('demo', 'Button', 'basic', '--format', format)).toMatchSnapshot();
    });
  }

  // error: demo not found
  it('demo Button nonexistent', () => {
    expect(runStderr('demo', 'Button', 'nonexistent')).toMatchSnapshot();
  });

  it('demo Button nonexistent --format json', () => {
    expect(runStderr('demo', 'Button', 'nonexistent', '--format', 'json')).toMatchSnapshot();
  });

  // error: component not found
  it('demo NonExistent', () => {
    expect(runStderr('demo', 'NonExistent')).toMatchSnapshot();
  });
});
