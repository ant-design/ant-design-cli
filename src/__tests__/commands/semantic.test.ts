import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('semantic', () => {
  it('should show semantic structure', async () => {
    const out = await run('semantic', 'Drawer');
    expect(out).toContain('header');
    expect(out).toContain('body');
    expect(out).toContain('classNames');
  });

  it('should show semantic as JSON', async () => {
    const out = await run('semantic', 'Drawer', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.name).toBe('Drawer');
    expect(data.semanticStructure.length).toBeGreaterThan(0);
  });

  it('should handle unknown component for semantic', async () => {
    const result = await runCLI('semantic', 'NonExistent');
    expect(result.exitCode).toBe(1);
  });
});