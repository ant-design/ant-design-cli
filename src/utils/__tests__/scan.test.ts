import { describe, it, expect } from 'vitest';
import { collectFiles, readJson, SCAN_EXTENSIONS, SKIP_DIRS } from '../scan.js';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

describe('collectFiles', () => {
  const tmpDir = join(__dirname, '__tmp_scan_test__');

  function setup() {
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    mkdirSync(join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(tmpDir, 'src', 'app.tsx'), 'export default () => {}');
    writeFileSync(join(tmpDir, 'src', 'style.css'), 'body {}');
    writeFileSync(join(tmpDir, 'node_modules', 'pkg', 'index.js'), '');
  }

  function cleanup() {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  it('should collect only source files', () => {
    setup();
    try {
      const files = collectFiles(tmpDir);
      const names = files.map((f) => f.replace(tmpDir, ''));
      expect(names).toContain('/src/app.tsx');
      expect(names).not.toContain('/src/style.css');
    } finally {
      cleanup();
    }
  });

  it('should skip node_modules', () => {
    setup();
    try {
      const files = collectFiles(tmpDir);
      const inNodeModules = files.filter((f) => f.includes('node_modules'));
      expect(inNodeModules).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('should return single file when given a file path', () => {
    setup();
    try {
      const filePath = join(tmpDir, 'src', 'app.tsx');
      expect(collectFiles(filePath)).toEqual([filePath]);
    } finally {
      cleanup();
    }
  });

  it('should return empty for non-existent path', () => {
    expect(collectFiles('/nonexistent/path')).toEqual([]);
  });
});

describe('readJson', () => {
  it('should return null for non-existent file', () => {
    expect(readJson('/nonexistent/file.json')).toBeNull();
  });
});

describe('constants', () => {
  it('SCAN_EXTENSIONS should include common source extensions', () => {
    expect(SCAN_EXTENSIONS.has('.ts')).toBe(true);
    expect(SCAN_EXTENSIONS.has('.tsx')).toBe(true);
    expect(SCAN_EXTENSIONS.has('.js')).toBe(true);
    expect(SCAN_EXTENSIONS.has('.jsx')).toBe(true);
    expect(SCAN_EXTENSIONS.has('.css')).toBe(false);
  });

  it('SKIP_DIRS should include common skip directories', () => {
    expect(SKIP_DIRS.has('node_modules')).toBe(true);
    expect(SKIP_DIRS.has('.git')).toBe(true);
    expect(SKIP_DIRS.has('dist')).toBe(true);
  });
});
