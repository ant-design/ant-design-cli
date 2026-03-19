import { describe, it, expect } from 'vitest';
import { loadMetadata, loadMetadataForVersion, findComponent, getAllComponentNames } from '../loader.js';

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

  it('should return empty store without throwing for nonexistent version', () => {
    // Covers the error-handling path (file not found)
    const store = loadMetadata('v_nonexistent_version');
    expect(store.components).toEqual([]);
    expect(store.majorVersion).toBe('v_nonexistent_version');
  });
});

describe('loadMetadataForVersion', () => {
  it('should load data for a full semver version', () => {
    const store = loadMetadataForVersion('5.21.0');
    expect(store.components.length).toBeGreaterThan(0);
  });

  it('should fall back to major version for unrecognized minor', () => {
    const store = loadMetadataForVersion('5.999.0');
    expect(store.components.length).toBeGreaterThan(0);
  });

  it('should fall back for version without minor part', () => {
    const store = loadMetadataForVersion('5');
    expect(store.components.length).toBeGreaterThan(0);
    expect(store.majorVersion).toBe('v5');
  });

  it('should return empty store for unknown major version', () => {
    const store = loadMetadataForVersion('99.0.0');
    expect(store.components).toEqual([]);
  });

  it('should load v4 snapshot', () => {
    const store = loadMetadataForVersion('4.24.0');
    expect(store.components.length).toBeGreaterThan(0);
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
