import { statSync } from 'node:fs';
import { join } from 'node:path';
import fg from 'fast-glob';

export const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
export const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

// .umi* matches umi's generated temp dirs (.umi, .umi-production, etc.)
const GLOB_IGNORE = [...SKIP_DIRS, '.umi*'].map((d) => `**/${d}/**`);

// Derive glob pattern from SCAN_EXTENSIONS to keep them in sync
const SOURCE_GLOB = `**/*.{${[...SCAN_EXTENSIONS].map((e) => e.slice(1)).join(',')}}`;

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

  try {
    return fg.globSync(SOURCE_GLOB, {
      cwd: dir,
      absolute: true,
      ignore: GLOB_IGNORE,
      onlyFiles: true,
    });
  } catch {
    return [];
  }
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

