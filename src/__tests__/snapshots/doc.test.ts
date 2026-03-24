import { describe, it, expect } from 'vitest';
import { run, runStderr, formats, langs } from '../snapshot-helper.js';

describe('doc', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`doc Button --format ${format} --lang ${lang}`, () => {
        expect(run('doc', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  it('doc NonExistent', () => {
    expect(runStderr('doc', 'NonExistent')).toMatchSnapshot();
  });

  it('doc Btn (typo)', () => {
    expect(runStderr('doc', 'Btn')).toMatchSnapshot();
  });
});
