import { statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'fast-glob';

export const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
export const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

const GLOB_IGNORE = [...SKIP_DIRS, '.umi*'].map((d) => `**/${d}/**`);

/**
 * Recursively collect source files from a directory or return a single file.
 */
export function collectFiles(dir: string): string[] {
  try {
    const stat = statSync(dir);
    if (stat.isFile()) return [dir];
  } catch {
    return [];
  }

  return globSync('**/*.{ts,tsx,js,jsx}', {
    cwd: dir,
    absolute: true,
    ignore: GLOB_IGNORE,
    onlyFiles: true,
  });
}

/** Get the component name from a JSX element name AST node (e.g. "Button", "Typography.Text"). */
export function getJSXElementName(name: any): string {
  if (name.type === 'JSXMemberExpression') {
    return getJSXElementName(name.object) + '.' + name.property.name;
  }
  if (name.type === 'JSXIdentifier') {
    return name.name;
  }
  return '';
}

/**
 * Read and parse a JSON file, returning null on failure.
 */
export function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}