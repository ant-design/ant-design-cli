import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { getComponentInfo, registerInfoCommand } from '../../commands/info.js';
import type { CLIError } from '../../types.js';

function createProgram(opts: { format?: string; version?: string; lang?: string; detail?: boolean } = {}) {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  program.option('--format <format>', 'Output format', opts.format ?? 'text');
  if (opts.version) {
    program.option('--version <version>', 'Target antd version', opts.version);
  } else {
    program.option('--version <version>', 'Target antd version');
  }
  program.option('--lang <lang>', 'Output language', opts.lang ?? 'en');
  program.option('--detail', 'Full information output', opts.detail ?? false);
  return program;
}

describe('getComponentInfo', () => {
  it('returns component info for a valid component', () => {
    const result = getComponentInfo('Button', { lang: 'en', version: '5.20.0', detail: false });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
      expect(result).toHaveProperty('nameZh');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('props');
      expect(Array.isArray(result.props)).toBe(true);
      expect(result.props.length).toBeGreaterThan(0);
    }
  });

  it('returns detail info when detail is true', () => {
    const result = getComponentInfo('Button', { lang: 'en', version: '5.20.0', detail: true });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'whenToUse' in result) {
      expect(result).toHaveProperty('whenToUse');
      expect(result).toHaveProperty('methods');
      expect(result).toHaveProperty('related');
      expect(result).toHaveProperty('faq');
    }
  });

  it('returns CLIError for non-existent component', () => {
    const result = getComponentInfo('NonExistent', { lang: 'en', version: '5.20.0', detail: false });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
    expect(err.message).toContain('NonExistent');
  });

  it('returns fuzzy match suggestion for typos', () => {
    const result = getComponentInfo('Buton', { lang: 'en', version: '5.20.0', detail: false });
    expect('error' in result).toBe(true);
    const err = result as CLIError;
    expect(err.code).toBe('COMPONENT_NOT_FOUND');
    expect(err.suggestion).toContain('Button');
  });

  it('works with v4', () => {
    const result = getComponentInfo('Button', { lang: 'en', version: '4.24.0', detail: false });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
    }
  });

  it('returns subComponentProps when available', () => {
    const result = getComponentInfo('Form', { lang: 'en', version: '5.29.0', detail: false });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.subComponentProps).toBeDefined();
    }
  });

  it('returns subComponentProps with descriptions in detail mode', () => {
    const result = getComponentInfo('Form', { lang: 'en', version: '5.29.0', detail: true });
    expect('error' in result).toBe(false);
    if (!('error' in result) && 'whenToUse' in result) {
      expect(result.subComponentProps).toBeDefined();
    }
  });

  it('returns zh descriptions when lang is zh', () => {
    const result = getComponentInfo('Button', { lang: 'zh', version: '5.20.0', detail: false });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.name).toBe('Button');
    }
  });
});

describe('registerInfoCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output JSON format', async () => {
    const program = createProgram({ format: 'json', version: '5.20.0' });
    registerInfoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'Button'], );
    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe('Button');
  });

  it('should output text format with props table', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerInfoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'Button'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Button');
    expect(allOutput).toContain('Property');
  });

  it('should output markdown format', async () => {
    const program = createProgram({ format: 'markdown', version: '5.20.0' });
    registerInfoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'Button'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Button');
  });

  it('should output detail mode with whenToUse', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0', detail: true });
    registerInfoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'Button'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Button');
  });

  it('should show subComponentProps in text format', async () => {
    const program = createProgram({ format: 'text', version: '5.29.0' });
    registerInfoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'Form'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Form');
  });

  it('should show detail with subComponentProps', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0', detail: true });
    registerInfoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'Form'], );
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('Form');
  });

  it('should handle error for non-existent component', async () => {
    const program = createProgram({ format: 'text', version: '5.20.0' });
    registerInfoCommand(program);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'NonExistent'], );
    expect(errSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it('should show related components in detail mode', async () => {
    // Use a component that has related components
    const loader = await import('../../data/loader.js');
    vi.spyOn(loader, 'resolveComponent').mockReturnValue({
      comp: {
        name: 'TestComp',
        nameZh: '测试',
        description: 'A test component',
        descriptionZh: '测试组件',
        whenToUse: 'When you need to test',
        whenToUseZh: '当你需要测试时',
        props: [{ name: 'size', type: 'string', default: '-', description: 'Size', descriptionZh: '尺寸', since: '5.0.0' }],
        subComponentProps: {
          'TestComp.Sub': [{ name: 'value', type: 'string', default: '-', description: 'Value', descriptionZh: '值', since: '5.0.0' }],
        },
        methods: [],
        related: ['Button', 'Input'],
        faq: [],
        demos: [],
        tokens: [],
      } as any,
    });

    const program = createProgram({ format: 'text', version: '5.20.0', detail: true });
    registerInfoCommand(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'info', 'TestComp']);
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');

    // Verify subComponentProps are rendered
    expect(allOutput).toContain('TestComp.Sub');
    // Verify related components are shown
    expect(allOutput).toContain('Related: Button, Input');
    vi.restoreAllMocks();
  });
});
