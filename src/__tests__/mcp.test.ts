import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS, createToolHandler } from '../mcp/tools.js';
import { ANTD_EXPERT_PROMPT, ANTD_PAGE_GENERATOR_PROMPT } from '../mcp/prompts.js';

const handler = createToolHandler({ version: '5.20.0', lang: 'en' });

function parse(result: { content: { text: string }[]; isError?: boolean }) {
  return JSON.parse(result.content[0].text);
}

describe('TOOL_DEFINITIONS', () => {
  it('has exactly 7 tools', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(7);
  });

  it('has correct tool names', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual([
      'antd_list',
      'antd_info',
      'antd_doc',
      'antd_demo',
      'antd_token',
      'antd_semantic',
      'antd_changelog',
    ]);
  });
});

describe('prompts', () => {
  it('exports ANTD_EXPERT_PROMPT', () => {
    expect(typeof ANTD_EXPERT_PROMPT).toBe('string');
    expect(ANTD_EXPERT_PROMPT.length).toBeGreaterThan(0);
  });

  it('exports ANTD_PAGE_GENERATOR_PROMPT', () => {
    expect(typeof ANTD_PAGE_GENERATOR_PROMPT).toBe('string');
    expect(ANTD_PAGE_GENERATOR_PROMPT.length).toBeGreaterThan(0);
  });
});

describe('antd_list', () => {
  it('returns array of components', async () => {
    const result = await handler('antd_list', {});
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // Should have trimmed fields only
    const first = data[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('nameZh');
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('description');
    expect(first).not.toHaveProperty('since');
    expect(first).not.toHaveProperty('descriptionZh');
  });
});

describe('antd_info', () => {
  it('returns props for Button', async () => {
    const result = await handler('antd_info', { component: 'Button' });
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(data.name).toBe('Button');
    expect(Array.isArray(data.props)).toBe(true);
    expect(data.props.length).toBeGreaterThan(0);
  });

  it('returns isError for unknown component', async () => {
    const result = await handler('antd_info', { component: 'NonExistentXyz' });
    expect(result.isError).toBe(true);
    const data = parse(result);
    expect(data.error).toBe(true);
    expect(data.code).toBe('COMPONENT_NOT_FOUND');
  });
});

describe('antd_doc', () => {
  it('returns doc content for Button', async () => {
    const result = await handler('antd_doc', { component: 'Button' });
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(data.name).toBe('Button');
    expect(typeof data.doc).toBe('string');
    expect(data.doc.length).toBeGreaterThan(0);
  });
});

describe('antd_demo', () => {
  it('lists demos for Button', async () => {
    const result = await handler('antd_demo', { component: 'Button' });
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(data.component).toBe('Button');
    expect(Array.isArray(data.demos)).toBe(true);
  });
});

describe('antd_token', () => {
  it('returns tokens for v5', async () => {
    const result = await handler('antd_token', {});
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(data).toHaveProperty('tokens');
    expect(Array.isArray(data.tokens)).toBe(true);
  });

  it('returns isError for v4', async () => {
    const v4Handler = createToolHandler({ version: '4.24.0', lang: 'en' });
    const result = await v4Handler('antd_token', {});
    expect(result.isError).toBe(true);
    const data = parse(result);
    expect(data.error).toBe(true);
    expect(data.code).toBe('UNSUPPORTED_VERSION_FEATURE');
  });
});

describe('antd_semantic', () => {
  it('returns semantic structure for Button', async () => {
    const result = await handler('antd_semantic', { component: 'Button' });
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(data.name).toBe('Button');
    expect(Array.isArray(data.semanticStructure)).toBe(true);
  });

  it('returns isError for unknown component', async () => {
    const result = await handler('antd_semantic', { component: 'NonExistentXyz' });
    expect(result.isError).toBe(true);
    const data = parse(result);
    expect(data.error).toBe(true);
    expect(data.code).toBe('COMPONENT_NOT_FOUND');
  });
});

describe('antd_changelog', () => {
  it('query mode returns entries', async () => {
    const result = await handler('antd_changelog', {});
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(data).toHaveProperty('entries');
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('diff mode works with v1 and v2', async () => {
    const result = await handler('antd_changelog', { v1: '5.20.0', v2: '5.20.0' });
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    expect(data.from).toBe('5.20.0');
    expect(data.to).toBe('5.20.0');
    expect(Array.isArray(data.diffs)).toBe(true);
  });

  it('returns isError when only v1 is provided', async () => {
    const result = await handler('antd_changelog', { v1: '5.20.0' });
    expect(result.isError).toBe(true);
    const data = parse(result);
    expect(data.code).toBe('INVALID_ARGUMENT');
  });

  it('returns isError when v1 > v2', async () => {
    const result = await handler('antd_changelog', { v1: '5.21.0', v2: '5.20.0' });
    expect(result.isError).toBe(true);
    const data = parse(result);
    expect(data.error).toBe(true);
    expect(data.code).toBe('INVALID_ARGUMENT');
  });
});
