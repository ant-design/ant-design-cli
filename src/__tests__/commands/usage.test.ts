import { describe, it, expect } from 'vitest';
import { run } from '../helper.js';

describe('usage', () => {
  it('should scan usage in current directory', async () => {
    const out = await run('usage', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('components');
  });
});