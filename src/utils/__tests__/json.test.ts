import { describe, it, expect } from 'vitest';
import { readJson } from '../json.js';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

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

  it('should support generic type parameter', () => {
    const tmpPath = join(__dirname, '__tmp_readjson_generic__.json');
    writeFileSync(tmpPath, JSON.stringify({ version: '1.0.0' }));
    try {
      const result = readJson<{ version: string }>(tmpPath);
      expect(result?.version).toBe('1.0.0');
    } finally {
      rmSync(tmpPath);
    }
  });
});