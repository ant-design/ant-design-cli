import { describe, it, expect } from 'vitest';
import { collectFiles, readJson, getJSXElementName, SCAN_EXTENSIONS, SKIP_DIRS } from '../scan.js';
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

  it('should return empty when directory cannot be read (permission error)', () => {
    // Create a directory, then mock readdirSync to throw for it
    const permDir = join(tmpDir, 'noperm');
    mkdirSync(permDir, { recursive: true });
    // Make it unreadable - on macOS/Linux we can chmod 000
    const { chmodSync } = require('node:fs');
    try {
      chmodSync(permDir, 0o000);
      const files = collectFiles(permDir);
      expect(files).toEqual([]);
    } finally {
      chmodSync(permDir, 0o755);
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('readJson', () => {
  it('should return null for non-existent file', () => {
    expect(readJson('/nonexistent/file.json')).toBeNull();
  });

  it('should return parsed JSON for valid file', () => {
    const tmpPath = join(__dirname, '__tmp_readjson_test__.json');
    writeFileSync(tmpPath, JSON.stringify({ name: 'test' }));
    try {
      const result = readJson(tmpPath);
      expect(result).toEqual({ name: 'test' });
    } finally {
      rmSync(tmpPath);
    }
  });

  it('should return null for invalid JSON', () => {
    const tmpPath = join(__dirname, '__tmp_readjson_bad__.json');
    writeFileSync(tmpPath, 'not json');
    try {
      expect(readJson(tmpPath)).toBeNull();
    } finally {
      rmSync(tmpPath);
    }
  });
});

describe('getJSXElementName', () => {
  it('should handle JSXIdentifier', () => {
    expect(getJSXElementName({ type: 'JSXIdentifier', name: 'Button' })).toBe('Button');
  });

  it('should handle JSXMemberExpression', () => {
    const node = {
      type: 'JSXMemberExpression',
      object: { type: 'JSXIdentifier', name: 'Form' },
      property: { name: 'Item' },
    };
    expect(getJSXElementName(node)).toBe('Form.Item');
  });

  it('should return empty string for unknown type', () => {
    expect(getJSXElementName({ type: 'Unknown' })).toBe('');
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
