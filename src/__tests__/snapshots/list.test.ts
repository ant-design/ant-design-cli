import { describe, it, expect } from 'vitest';
import { run, formats, langs } from '../snapshot-helper.js';

describe('list', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`list --format ${format} --lang ${lang}`, () => {
        expect(run('list', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }
});
