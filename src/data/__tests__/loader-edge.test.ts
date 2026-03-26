/**
 * Edge-case tests for loader.ts to cover:
 * - lines 102-103: versions.json parse failure in loadMetadataForVersionUncached
 * - lines 114-115: tryLoadSnapshot parse failure
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// We need to create temporary files in the data directory to trigger edge cases.
// The approach: temporarily replace versions.json with corrupt content,
// and create a corrupt snapshot file.

describe('loadMetadataForVersion edge cases', () => {
  const dataDir = join(__dirname, '..', '..', '..', 'data');
  const versionsPath = join(dataDir, 'versions.json');
  let originalVersions: string;

  beforeEach(() => {
    // Save original versions.json
    originalVersions = readFileSync(versionsPath, 'utf-8');
  });

  afterEach(() => {
    // Restore versions.json
    writeFileSync(versionsPath, originalVersions);
    // Clean up any corrupt snapshot files
    try { rmSync(join(dataDir, 'v99.88.77.json')); } catch {}
  });

  it('should fall back to loadMetadata when versions.json is corrupt (lines 102-103)', async () => {
    // Corrupt versions.json
    writeFileSync(versionsPath, 'NOT VALID JSON{{{');

    // Clear the metadata cache by re-importing
    vi.resetModules();
    const { loadMetadataForVersion: freshLoad } = await import('../loader.js');

    // This should catch the JSON parse error and fall back to loadMetadata('v5')
    const store = freshLoad('5.21.0');
    expect(store.components.length).toBeGreaterThan(0);
  });

  it('should return null from tryLoadSnapshot when snapshot file is corrupt (lines 114-115)', async () => {
    // Create a corrupt snapshot file that will be found by existsSync
    const corruptTag = '99.88.77';
    const corruptPath = join(dataDir, `v${corruptTag}.json`);
    writeFileSync(corruptPath, 'CORRUPT JSON DATA{{{');

    // Modify versions.json to point to this corrupt snapshot
    const versionsIndex = JSON.parse(originalVersions);
    versionsIndex['v99'] = { '99.88': corruptTag };
    writeFileSync(versionsPath, JSON.stringify(versionsIndex));

    vi.resetModules();
    const { loadMetadataForVersion: freshLoad } = await import('../loader.js');

    // This should find the snapshot file, fail to parse it, return null,
    // and ultimately fall back to loadMetadata('v99') which returns empty store
    const store = freshLoad('99.88.0');
    expect(store.components).toEqual([]);
  });
});
