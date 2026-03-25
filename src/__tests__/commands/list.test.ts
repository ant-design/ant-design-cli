import { describe, it, expect } from 'vitest';
import { listComponents } from '../../commands/list.js';

describe('listComponents', () => {
  it('returns an array of ComponentSummary for v5', () => {
    const result = listComponents({ version: '5.20.0' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const first = result[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('nameZh');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('descriptionZh');
    expect(first).toHaveProperty('since');
    expect(first).toHaveProperty('category');
    expect(typeof first.name).toBe('string');
  });

  it('returns components for v4', () => {
    const result = listComponents({ version: '4.24.0' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes Button component', () => {
    const result = listComponents({ version: '5.20.0' });
    const button = result.find((c) => c.name === 'Button');
    expect(button).toBeDefined();
    expect(button!.name).toBe('Button');
  });
});
