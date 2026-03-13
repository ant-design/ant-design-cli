import { describe, it, expect } from 'vitest';
import { loadMetadata, findComponent, getAllComponentNames } from '../loader.js';

describe('loadMetadata', () => {
  it('should load v5 data', () => {
    const store = loadMetadata('v5');
    expect(store.components.length).toBeGreaterThan(0);
    expect(store.majorVersion).toBe('v5');
  });

  it('should return empty store for unknown version', () => {
    const store = loadMetadata('v99');
    expect(store.components).toEqual([]);
  });
});

describe('findComponent', () => {
  const store = loadMetadata('v5');

  it('should find component by name (case-insensitive)', () => {
    const button = findComponent(store, 'button');
    expect(button).toBeDefined();
    expect(button!.name).toBe('Button');
  });

  it('should return undefined for non-existent component', () => {
    expect(findComponent(store, 'NonExistent')).toBeUndefined();
  });
});

describe('getAllComponentNames', () => {
  it('should return all component names', () => {
    const store = loadMetadata('v5');
    const names = getAllComponentNames(store);
    expect(names).toContain('Button');
    expect(names).toContain('Table');
    expect(names).toContain('Select');
  });
});
