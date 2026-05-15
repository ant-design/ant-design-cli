import { describe, it, expect } from 'vitest';
import { run, runCLI } from '../helper.js';

describe('changelog', () => {
  it('should show changelog', async () => {
    const out = await run('changelog', '5.21.0');
    expect(out).toContain('5.21.0');
    expect(out).toContain('Segmented');
  });

  it('should show changelog range', async () => {
    const out = await run('changelog', '5.20.0..5.22.0');
    expect(out).toContain('5.20.0');
    expect(out).toContain('5.21.0');
    expect(out).toContain('5.22.0');
  });

  it('should show changelog as JSON', async () => {
    const out = await run('changelog', '5.21.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].version).toBe('5.21.0');
  });

  it('should handle changelog version not found', async () => {
    const result = await runCLI('changelog', '5.99.99');
    expect(result.exitCode).toBe(1);
  });

  it('should error when from > to', async () => {
    const result = await runCLI('changelog', '5.5.0', '5.1.0');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('newer than');
  });

  it('should show API diff between versions', async () => {
    const out = await run('changelog', '5.0.0', '5.24.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(data).toHaveProperty('from');
    expect(data).toHaveProperty('to');
  });
});