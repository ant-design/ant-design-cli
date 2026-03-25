import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
export const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

/**
 * Recursively collect source files from a directory or return a single file.
 */
export function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const stat = statSync(dir);
    if (stat.isFile()) return [dir];
  } catch {
    return [];
  }
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.umi') || SKIP_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath));
      } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch {
    // ignore permission errors etc
  }
  return files;
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
