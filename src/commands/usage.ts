import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { output } from '../output/formatter.js';

interface ComponentUsage {
  name: string;
  imports: number;
  files: string[];
  subComponents?: Record<string, number>;
}

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.umi']);

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && SKIP_DIRS.has(entry.name)) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
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

// Match: import { Button, Form } from 'antd'
// Match: import { Table } from 'antd/es/table'
const ANTD_IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"]antd(?:\/[^'"]*)?['"]/g;
// Match: Form.Item, Table.Column etc
const SUB_COMPONENT_RE = /\b(\w+)\.(\w+)\b/g;

function scanFile(filePath: string): Map<string, { count: number; subComponents: Map<string, number> }> {
  const result = new Map<string, { count: number; subComponents: Map<string, number> }>();

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return result;
  }

  // Find antd imports
  const importedNames: string[] = [];
  let match: RegExpExecArray | null;
  ANTD_IMPORT_RE.lastIndex = 0;
  while ((match = ANTD_IMPORT_RE.exec(content)) !== null) {
    const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
    importedNames.push(...names);
  }

  for (const name of importedNames) {
    if (!result.has(name)) {
      result.set(name, { count: 0, subComponents: new Map() });
    }
    result.get(name)!.count++;
  }

  // Find sub-component usage (e.g. Form.Item)
  SUB_COMPONENT_RE.lastIndex = 0;
  while ((match = SUB_COMPONENT_RE.exec(content)) !== null) {
    const [, parent, child] = match;
    if (importedNames.includes(parent)) {
      const entry = result.get(parent)!;
      const subKey = `${parent}.${child}`;
      entry.subComponents.set(subKey, (entry.subComponents.get(subKey) || 0) + 1);
    }
  }

  return result;
}

export function registerUsageCommand(program: Command): void {
  program
    .command('usage [dir]')
    .description('Scan project for antd component/API usage statistics')
    .action((dir?: string) => {
      const opts = program.opts<GlobalOptions>();
      const targetDir = dir || '.';

      const files = collectFiles(targetDir);
      const aggregated = new Map<string, { imports: number; files: Set<string>; subComponents: Map<string, number> }>();

      for (const file of files) {
        const fileUsage = scanFile(file);
        for (const [name, data] of fileUsage) {
          if (!aggregated.has(name)) {
            aggregated.set(name, { imports: 0, files: new Set(), subComponents: new Map() });
          }
          const agg = aggregated.get(name)!;
          agg.imports += data.count;
          agg.files.add(file);
          for (const [sub, count] of data.subComponents) {
            agg.subComponents.set(sub, (agg.subComponents.get(sub) || 0) + count);
          }
        }
      }

      const components: ComponentUsage[] = [...aggregated.entries()]
        .sort((a, b) => b[1].imports - a[1].imports)
        .map(([name, data]) => {
          const usage: ComponentUsage = {
            name,
            imports: data.imports,
            files: [...data.files],
          };
          if (data.subComponents.size > 0) {
            usage.subComponents = Object.fromEntries(data.subComponents);
          }
          return usage;
        });

      const totalImports = components.reduce((sum, c) => sum + c.imports, 0);

      if (opts.format === 'json') {
        output({
          scanned: files.length,
          components,
          summary: { totalComponents: components.length, totalImports },
        }, 'json');
        return;
      }

      console.log(`Scanned ${files.length} files in ${targetDir}\n`);

      if (components.length === 0) {
        console.log('No antd imports found.');
        return;
      }

      for (const comp of components) {
        console.log(`  ${comp.name} — ${comp.imports} imports across ${comp.files.length} files`);
        if (comp.subComponents) {
          for (const [sub, count] of Object.entries(comp.subComponents)) {
            console.log(`    ${sub}: ${count} usages`);
          }
        }
      }

      console.log(`\nTotal: ${components.length} components, ${totalImports} imports`);
    });
}
