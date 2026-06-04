import { describe, it, expect, vi } from 'vitest';
import { run, runCLI } from '../helper.js';
import { getDesign } from '../../commands/design.js';
import * as loader from '../../data/loader.js';

describe('design', () => {
  it('should output the design.md document', async () => {
    const out = await run('design');
    // YAML front-matter conformant with the design.md spec
    expect(out).toContain('name: Ant Design');
    expect(out).toContain('colors:');
    expect(out).toContain('typography:');
    // Prose sections
    expect(out).toContain('## Overview');
    expect(out).toContain("## Do's and Don'ts");
  });

  it('should output design.md as JSON', async () => {
    const out = await run('design', '--format', 'json');
    const data = JSON.parse(out);
    expect(typeof data.doc).toBe('string');
    expect(data.doc).toContain('name: Ant Design');
  });

  it('should ignore version flag (design.md is version-independent)', async () => {
    const result = await runCLI('design', '--version', '4.24.0');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('name: Ant Design');
  });

  it('getDesign returns an error when design.md is missing', () => {
    const spy = vi.spyOn(loader, 'loadDesignDoc').mockReturnValue(null);
    try {
      const result = getDesign();
      expect('error' in result && result.error).toBe(true);
      expect((result as { code: string }).code).toBe('DOC_NOT_AVAILABLE');
    } finally {
      spy.mockRestore();
    }
  });

  it('command prints an error and exits 1 when design.md is missing', async () => {
    const spy = vi.spyOn(loader, 'loadDesignDoc').mockReturnValue(null);
    try {
      const result = await runCLI('design');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not available');
    } finally {
      spy.mockRestore();
    }
  });
});
