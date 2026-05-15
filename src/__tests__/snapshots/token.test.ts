import { describe, it, expect } from 'vitest';
import { run, runStderr, formats, langs } from '../snapshot-helper.js';

describe('token', () => {
  // global tokens
  for (const format of formats) {
    it(`token --format ${format} (global)`, async () => {
      expect(await run('token', '--format', format)).toMatchSnapshot();
    });
  }

  // component tokens
  for (const format of formats) {
    for (const lang of langs) {
      it(`token Button --format ${format} --lang ${lang}`, async () => {
        expect(await run('token', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  // error
  it('token NonExistent', async () => {
    expect(await runStderr('token', 'NonExistent')).toMatchSnapshot();
  });
});