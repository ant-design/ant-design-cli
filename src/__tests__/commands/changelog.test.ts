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

  it('should print human-readable API diff (non-json)', async () => {
    const out = await run('changelog', '5.0.0', '5.24.0');
    expect(out).toContain('API Diff:');
  });

  it('should error for unknown major version with no changelog data', async () => {
    // Version 999.x has no snapshot data — should use structured error path
    const result = await runCLI('changelog', '999.0.0');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('No changelog data available');
  });

  it('should error for unknown major version with JSON format', async () => {
    const result = await runCLI('changelog', '999.0.0', '--format', 'json');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('VERSION_NOT_FOUND');
    expect(err.error).toBe(true);
  });

  it('should error in diff mode when v1 version has no data (older major)', async () => {
    const result = await runCLI('changelog', '0.0.1', '5.20.0', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('VERSION_NOT_FOUND');
  });

  it('should error in diff mode when v2 version has no data (newer major)', async () => {
    const result = await runCLI('changelog', '5.20.0', '999.0.0', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('VERSION_NOT_FOUND');
  });

  it('should error in diff mode when component is not in either version', async () => {
    const result = await runCLI('changelog', '5.0.0', '5.20.0', 'NonExistent', '--format', 'json');
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('should print "No API differences" when comparing the same version', async () => {
    const out = await run('changelog', '5.20.0', '5.20.0');
    expect(out).toContain('No API differences');
  });

  it('should diff a component removed between major versions', async () => {
    // BackTop existed in v4 but was removed in v5
    const out = await run('changelog', '4.24.0', '5.24.0', 'BackTop', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.component).toBe('BackTop');
    expect(data.removed.length).toBeGreaterThan(0);
  });

  it('should diff a component added between major versions', async () => {
    // FloatButton was added in v5
    const out = await run('changelog', '4.24.0', '5.24.0', 'FloatButton', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.component).toBe('FloatButton');
    expect(data.added.length).toBeGreaterThan(0);
  });
});