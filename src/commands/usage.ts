import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { localize } from '../types.js';
import { readFileSync } from 'node:fs';
import { parseSync, Visitor } from 'oxc-parser';
import { formatTable, output } from '../output/formatter.js';
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

      if (opts.format === 'markdown') {
        console.log(`## ${localize(`antd Usage in ${targetDir}`, `${targetDir} 中的 antd 用法`, opts.lang)}`);
        console.log('');
        console.log(localize(
          `Scanned ${files.length} files.`,
          `扫描了 ${files.length} 个文件。`,
          opts.lang,
        ));
        console.log('');

        if (components.length === 0 && nonComponents.length === 0) {
          console.log(localize('No antd imports found.', '未找到 antd 导入。', opts.lang));
          return;
        }

        if (components.length > 0) {
          console.log(`### ${localize('Components', '组件', opts.lang)}`);
          console.log('');
          const headers = [
            localize('Component', '组件', opts.lang),
            localize('Imports', '导入次数', opts.lang),
            localize('Files', '文件数', opts.lang),
          ];
          const rows = components.map((c) => [c.name, String(c.imports), String(c.files.length)]);
          console.log(formatTable(headers, rows, 'markdown'));
          if (components.some((c) => c.subComponents)) {
            console.log('');
            for (const comp of components) {
              if (comp.subComponents) {
                for (const [sub, count] of Object.entries(comp.subComponents)) {
                  console.log(localize(`- ${sub}: ${count} usages`, `- ${sub}: ${count} 次使用`, opts.lang));
                }
              }
            }
          }
          console.log('');
          console.log(`**${localize('Total:', '合计：', opts.lang)}** ${localize(`${components.length} components`, `${components.length} 个组件`, opts.lang)}, ${localize(`${totalImports} imports`, `${totalImports} 次导入`, opts.lang)}`);
        }

        if (nonComponents.length > 0) {
          console.log('');
          console.log(`### ${localize('Non-component exports', '非组件导出', opts.lang)}`);
          console.log('');
          const ncHeaders = [
            localize('Export', '导出', opts.lang),
            localize('Imports', '导入次数', opts.lang),
            localize('Files', '文件数', opts.lang),
          ];
          const ncRows = nonComponents.map((c) => [c.name, String(c.imports), String(c.files.length)]);
          console.log(formatTable(ncHeaders, ncRows, 'markdown'));
        }
        return;
      }

      console.log(localize(
        `Scanned ${files.length} files in ${targetDir}`,
        `在 ${targetDir} 中扫描了 ${files.length} 个文件`,
        opts.lang,
      ) + '\n');

      if (components.length === 0 && nonComponents.length === 0) {
        console.log(localize('No antd imports found.', '未找到 antd 导入。', opts.lang));
        return;
      }

      if (components.length > 0) {
        for (const comp of components) {
          console.log(localize(
            `  ${comp.name} — ${comp.imports} imports across ${comp.files.length} files`,
            `  ${comp.name} — ${comp.imports} 次导入，涉及 ${comp.files.length} 个文件`,
            opts.lang,
          ));
          if (comp.subComponents) {
            for (const [sub, count] of Object.entries(comp.subComponents)) {
              console.log(localize(
                `    ${sub}: ${count} usages`,
                `    ${sub}: ${count} 次使用`,
                opts.lang,
              ));
            }
          }
        }
        console.log(`\n${localize('Total:', '合计：', opts.lang)} ${localize(`${components.length} components`, `${components.length} 个组件`, opts.lang)}, ${localize(`${totalImports} imports`, `${totalImports} 次导入`, opts.lang)}`);
      }

      if (nonComponents.length > 0) {
        console.log(localize(
          `\nNon-component antd exports (${nonComponents.length}):`,
          `\n非组件 antd 导出（${nonComponents.length} 个）：`,
          opts.lang,
        ));
        for (const item of nonComponents) {
          console.log(localize(
            `  ${item.name} — ${item.imports} imports across ${item.files.length} files`,
            `  ${item.name} — ${item.imports} 次导入，涉及 ${item.files.length} 个文件`,
            opts.lang,
          ));
        }
      }
    });
}
