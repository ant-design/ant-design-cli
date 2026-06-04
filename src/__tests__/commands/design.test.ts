import { describe, it, expect, vi } from 'vitest';
import { run, runCLI } from '../helper.js';
import { getDesign } from '../../commands/design.js';
import * as loader from '../../data/loader.js';

describe('design', () => {
  it('should output the v6 design.md document', async () => {
    const out = await run('design', '--version', '6.4.0');
    // YAML front-matter conformant with the design.md spec
    expect(out).toContain('name: Ant Design');
    expect(out).toContain('colors:');
    expect(out).toContain('typography:');
    // Prose sections
    expect(out).toContain('## Overview');
    expect(out).toContain("## Do's and Don'ts");
  });

  it('should output design.md as JSON', async () => {
    const out = await run('design', '--version', '6.4.0', '--format', 'json');
    const data = JSON.parse(out);
    expect(typeof data.doc).toBe('string');
    expect(data.doc).toContain('name: Ant Design');
  });

  it('should error for a major without a design.md (v5)', async () => {
    const result = await runCLI('design', '--version', '5.24.0');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not available for antd v5');
  });

  it('should error for a major without a design.md (v4)', async () => {
    const result = await runCLI('design', '--version', '4.24.0');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not available for antd v4');
  });

  it('getDesign returns UNSUPPORTED_VERSION_FEATURE when the doc is missing', () => {
    const spy = vi.spyOn(loader, 'loadDesignDoc').mockReturnValue(null);
    try {
      const result = getDesign({ version: '6.0.0' });
      expect('error' in result && result.error).toBe(true);
      expect((result as { code: string }).code).toBe('UNSUPPORTED_VERSION_FEATURE');
    } finally {
      spy.mockRestore();
    }
  });

  it('getDesign resolves the major from the version', () => {
    const spy = vi.spyOn(loader, 'loadDesignDoc').mockReturnValue('# stub');
    try {
      getDesign({ version: '6.4.3' });
      expect(spy).toHaveBeenCalledWith('v6');
    } finally {
      spy.mockRestore();
    }
  });
});
