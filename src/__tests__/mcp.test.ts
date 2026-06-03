import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS, createToolHandler } from '../mcp/tools.js';
import { ANTD_EXPERT_PROMPT, ANTD_PAGE_GENERATOR_PROMPT } from '../mcp/prompts.js';

const ctx = { version: '5.24.0', lang: 'en' };
const handle = createToolHandler(ctx);

function parseResult(result: { content: { text: string }[]; isError?: boolean }): unknown {
  return JSON.parse(result.content[0].text);
}

describe('mcp tools', () => {
  it('exposes 7 tool definitions with consistent annotations', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(7);
    for (const def of TOOL_DEFINITIONS) {
      expect(def.name).toMatch(/^antd_/);
      expect(def.annotations.readOnlyHint).toBe(true);
      expect(def.annotations.destructiveHint).toBe(false);
    }
  });

  it('antd_list returns trimmed component list', async () => {
    const result = await handle('antd_list', {});
    const data = parseResult(result) as { name: string; category: string }[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('category');
    // Trimmed: must not include other fields
    expect(data[0]).not.toHaveProperty('props');
  });

  it('antd_info returns component info', async () => {
    const result = await handle('antd_info', { component: 'Button' });
    const data = parseResult(result) as { name: string; props: unknown[]; commonProps: { name: string }[]; htmlElement: string };
    expect(data.name).toBe('Button');
    expect(data.props.length).toBeGreaterThan(0);
    expect(data.commonProps).toBeDefined();
    expect(data.commonProps.map((p) => p.name)).toEqual(['className', 'style', 'rootClassName']);
    expect(data.htmlElement).toBe('button');
  });

  it('antd_info omits commonProps for ConfigProvider', async () => {
    const result = await handle('antd_info', { component: 'ConfigProvider' });
    const data = parseResult(result) as { name: string; commonProps?: unknown[]; htmlElement?: string };
    expect(data.name).toBe('ConfigProvider');
    expect(data.commonProps).toBeUndefined();
    expect(data.htmlElement).toBeUndefined();
  });

  it('antd_info honours detail flag', async () => {
    const result = await handle('antd_info', { component: 'Button', detail: true });
    const data = parseResult(result) as { whenToUse?: string };
    expect(data).toHaveProperty('whenToUse');
  });

  it('antd_info returns error result for unknown component', async () => {
    const result = await handle('antd_info', { component: 'Nope' });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: boolean; code: string };
    expect(data.error).toBe(true);
    expect(data.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('antd_doc returns markdown doc', async () => {
    const result = await handle('antd_doc', { component: 'Button' });
    const data = parseResult(result) as { doc: string };
    expect(typeof data.doc).toBe('string');
    expect(data.doc.length).toBeGreaterThan(0);
  });

  it('antd_demo without name lists demos', async () => {
    const result = await handle('antd_demo', { component: 'Button' });
    const data = parseResult(result) as { component: string; demos: { name: string }[] };
    expect(data.component).toBe('Button');
    expect(Array.isArray(data.demos)).toBe(true);
    expect(data.demos.length).toBeGreaterThan(0);
  });

  it('antd_demo with name returns specific demo', async () => {
    const list = parseResult(await handle('antd_demo', { component: 'Button' })) as { demos: { name: string }[] };
    expect(list.demos.length).toBeGreaterThan(0);
    const firstName = list.demos[0].name;
    const result = await handle('antd_demo', { component: 'Button', name: firstName });
    const data = parseResult(result) as { component: string; demo: string; code: string };
    expect(data.component).toBe('Button');
    expect(data.demo).toBe(firstName);
    expect(typeof data.code).toBe('string');
    expect(data.code.length).toBeGreaterThan(0);
  });

  it('antd_token returns global tokens without component', async () => {
    const result = await handle('antd_token', {});
    const data = parseResult(result) as { tokens: unknown[] };
    expect(Array.isArray(data.tokens)).toBe(true);
    expect(data.tokens.length).toBeGreaterThan(0);
  });

  it('antd_token returns component tokens with component name', async () => {
    const result = await handle('antd_token', { component: 'Button' });
    const data = parseResult(result) as { component: string; tokens: unknown[] };
    expect(data.component).toBe('Button');
    expect(Array.isArray(data.tokens)).toBe(true);
  });

  it('antd_semantic returns semantic structure', async () => {
    const result = await handle('antd_semantic', { component: 'Drawer' });
    const data = parseResult(result) as { name: string; semanticStructure: unknown[] };
    expect(data.name).toBe('Drawer');
    expect(Array.isArray(data.semanticStructure)).toBe(true);
    expect(data.semanticStructure.length).toBeGreaterThan(0);
  });

  it('antd_changelog query mode without args returns entries array', async () => {
    const result = await handle('antd_changelog', {});
    const data = parseResult(result) as { entries: { version: string }[] };
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('antd_changelog query mode with version filter returns matching entry', async () => {
    const result = await handle('antd_changelog', { version: '5.20.0' });
    const data = parseResult(result) as { entries: { version: string }[] };
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.entries.some((e) => e.version === '5.20.0')).toBe(true);
  });

  it('antd_changelog diff mode with v1 and v2 returns from/to/diffs', async () => {
    const result = await handle('antd_changelog', { v1: '5.18.0', v2: '5.20.0' });
    const data = parseResult(result) as { from: string; to: string; diffs: unknown[] };
    expect(data.from).toBe('5.18.0');
    expect(data.to).toBe('5.20.0');
    expect(Array.isArray(data.diffs)).toBe(true);
  });

  it('antd_changelog diff mode with component filter returns single-component diff', async () => {
    const result = await handle('antd_changelog', { v1: '5.18.0', v2: '5.20.0', component: 'Button' });
    const data = parseResult(result) as { from: string; to: string; component: string };
    expect(data.from).toBe('5.18.0');
    expect(data.to).toBe('5.20.0');
    expect(data.component).toBe('Button');
  });

  it('antd_changelog errors when only v1 is provided', async () => {
    const result = await handle('antd_changelog', { v1: '5.18.0' });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { code: string };
    expect(data.code).toBe('INVALID_ARGUMENT');
  });

  it('antd_changelog errors when only v2 is provided', async () => {
    const result = await handle('antd_changelog', { v2: '5.20.0' });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { code: string };
    expect(data.code).toBe('INVALID_ARGUMENT');
  });

  it('returns UNKNOWN_TOOL error for unknown tool name', async () => {
    const result = await handle('antd_unknown', {});
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { code: string };
    expect(data.code).toBe('UNKNOWN_TOOL');
  });
});

describe('mcp prompts', () => {
  it('exports antd-expert prompt content', () => {
    expect(typeof ANTD_EXPERT_PROMPT).toBe('string');
    expect(ANTD_EXPERT_PROMPT.length).toBeGreaterThan(0);
  });

  it('exports antd-page-generator prompt content', () => {
    expect(typeof ANTD_PAGE_GENERATOR_PROMPT).toBe('string');
    expect(ANTD_PAGE_GENERATOR_PROMPT.length).toBeGreaterThan(0);
  });
});
