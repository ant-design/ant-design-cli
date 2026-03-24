import { describe, it, expect } from 'vitest';
import { run, runStderr, formats, langs } from '../snapshot-helper.js';

describe('semantic', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`semantic Drawer --format ${format} --lang ${lang}`, () => {
        expect(run('semantic', 'Drawer', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  it('semantic NonExistent', () => {
    expect(runStderr('semantic', 'NonExistent')).toMatchSnapshot();
  });
});
