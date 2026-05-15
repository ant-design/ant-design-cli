import { describe, it, expect } from 'vitest';
import { run } from '../snapshot-helper.js';

describe('help', () => {
  it('--help', async () => {
    expect(await run('--help')).toMatchSnapshot();
  });
});