import { statSync, readFileSync } from 'node:fs';
import fg from 'fast-glob';
import { parseSync, Visitor } from 'oxc-parser';

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

/** Scan a single file for antd component imports and sub-component JSX usage. */
export function scanFile(filePath: string): Map<string, { count: number; subComponents: Map<string, number> }> {
  const result = new Map<string, { count: number; subComponents: Map<string, number> }>();

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  /* v8 ignore start -- fs read error */
  } catch {
    return result;
  }
  /* v8 ignore stop */

  if (!content.includes('antd')) return result;

  const parsed = parseSync(filePath, content);
  if (parsed.errors.length > 0) return result;

  const importedNames = new Set<string>();

  const visitor = new Visitor({
    ImportDeclaration(node: any) {
      const source = node.source.value;
      if (source !== 'antd' && !source.startsWith('antd/')) return;
      if (node.importKind === 'type') return;

      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          if (spec.importKind === 'type') continue;
          const name = spec.imported?.name || spec.local?.name;
          if (name) {
            importedNames.add(name);
            if (!result.has(name)) {
              result.set(name, { count: 0, subComponents: new Map() });
            }
            result.get(name)!.count++;
          }
        }
      }
    },

    JSXOpeningElement(node: any) {
      const fullName = getJSXElementName(node.name);
      if (!fullName.includes('.')) return;
      const [parent] = fullName.split('.');
      if (importedNames.has(parent)) {
        const entry = result.get(parent);
        if (entry) {
          entry.subComponents.set(fullName, (entry.subComponents.get(fullName) || 0) + 1);
        }
      }
    },
  });
  visitor.visit(parsed.program);

  return result;
}

