import { describe, it, expect } from 'vitest';
import { run, runStderr, formats, langs } from '../snapshot-helper.js';

describe('semantic', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`semantic Drawer --format ${format} --lang ${lang}`, async () => {
        expect(await run('semantic', 'Drawer', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  it('semantic NonExistent', async () => {
    expect(await runStderr('semantic', 'NonExistent')).toMatchSnapshot();
  });
});