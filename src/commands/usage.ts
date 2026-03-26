import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync } from 'node:fs';
import { parseSync, Visitor } from 'oxc-parser';
import { output } from '../output/formatter.js';
import { collectFiles, getJSXElementName } from '../utils/scan.js';
import { loadMetadataForVersion } from '../data/loader.js';
import { detectVersion } from '../data/version.js';

interface ComponentUsage {
  name: string;
  imports: number;
  files: string[];
  subComponents?: Record<string, number>;
}

function scanFile(filePath: string): Map<string, { count: number; subComponents: Map<string, number> }> {
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

    // Detect sub-component JSX usage: <Form.Item>, <Table.Column>, etc.
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

export function registerUsageCommand(program: Command): void {
  program
    .command('usage [dir]')
    .description('Scan project for antd component/API usage statistics')
    .option('-f, --filter <component>', 'Filter results to a specific component (e.g. Button)')
    .action((dir?: string, cmdOpts?: { filter?: string }) => {
      const opts = program.opts<GlobalOptions>();
      const targetDir = dir || '.';
      const filterName = cmdOpts?.filter?.toLowerCase();

      const versionInfo = detectVersion(opts.version);
      const store = loadMetadataForVersion(versionInfo.version);
      const knownComponents = new Set(store.components.map((c) => c.name));
      for (const comp of store.components) {
        for (const subKey of Object.keys(comp.subComponentProps ?? {})) {
          const leaf = subKey.split('.').pop();
          if (leaf) knownComponents.add(leaf);
        }
      }

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

      const toUsage = ([name, data]: [string, { imports: number; files: Set<string>; subComponents: Map<string, number> }]): ComponentUsage => {
        const usage: ComponentUsage = {
          name,
          imports: data.imports,
          files: [...data.files],
        };
        if (data.subComponents.size > 0) {
          usage.subComponents = Object.fromEntries(data.subComponents);
        }
        return usage;
      };

      const allEntries = [...aggregated.entries()]
        .filter(([name]) => !filterName || name.toLowerCase() === filterName)
        .sort((a, b) => b[1].imports - a[1].imports);

      const components: ComponentUsage[] = allEntries
        .filter(([name]) => knownComponents.has(name))
        .map(toUsage);

      const nonComponents: ComponentUsage[] = allEntries
        .filter(([name]) => !knownComponents.has(name))
        .map(toUsage);

      const totalImports = components.reduce((sum, c) => sum + c.imports, 0);

      if (opts.format === 'json') {
        output({
          scanned: files.length,
          components,
          nonComponents,
          summary: { totalComponents: components.length, totalImports },
        }, 'json');
        return;
      }

      console.log(`Scanned ${files.length} files in ${targetDir}\n`);

      if (components.length === 0 && nonComponents.length === 0) {
        console.log('No antd imports found.');
        return;
      }

      if (components.length > 0) {
        for (const comp of components) {
          console.log(`  ${comp.name} — ${comp.imports} imports across ${comp.files.length} files`);
          if (comp.subComponents) {
            for (const [sub, count] of Object.entries(comp.subComponents)) {
              console.log(`    ${sub}: ${count} usages`);
            }
          }
        }
        console.log(`\nTotal: ${components.length} components, ${totalImports} imports`);
      }

      if (nonComponents.length > 0) {
        console.log(`\nNon-component antd exports (${nonComponents.length}):`);
        for (const item of nonComponents) {
          console.log(`  ${item.name} — ${item.imports} imports across ${item.files.length} files`);
        }
      }
    });
}
