import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync } from 'node:fs';
import { output } from '../output/formatter.js';
import { collectFiles, parseAntdImports } from '../utils/scan.js';

interface ComponentUsage {
  name: string;
  imports: number;
  files: string[];
  subComponents?: Record<string, number>;
}

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

  const importedNames = parseAntdImports(content);

  for (const name of importedNames) {
    if (!result.has(name)) {
      result.set(name, { count: 0, subComponents: new Map() });
    }
    result.get(name)!.count++;
  }

  // Find sub-component usage (e.g. Form.Item)
  SUB_COMPONENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
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
