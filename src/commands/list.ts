import type { Command } from 'commander';
import type { GlobalOptions, CLIError } from '../types.js';
import { loadMetadataForVersion } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { formatTable, output } from '../output/formatter.js';

export interface ComponentSummary {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  since: string;
  category: string;
}

/**
 * Core function: list all components for a given antd version.
 * Returns an array of ComponentSummary objects. Never writes to stdout.
 */
export function listComponents(opts: { version: string }): ComponentSummary[] {
  const store = loadMetadataForVersion(opts.version);
  return store.components.map((c) => ({
    name: c.name,
    nameZh: c.nameZh ?? '',
    description: c.description,
    descriptionZh: c.descriptionZh ?? '',
    since: c.since ?? '',
    category: c.category ?? '',
  }));
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all components with bilingual names, descriptions, and first-supported version')
    .action(() => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const components = listComponents({ version: versionInfo.version });

      if (components.length === 0) {
        console.log('No component data available.');
        return;
      }

      if (opts.format === 'json') {
        const data = components.map(({ category, ...rest }) => rest);
        output(data, 'json');
        return;
      }

      if (opts.format === 'markdown') {
        const lines: string[] = [
          `# antd Components (${versionInfo.version})`,
          '',
          '| Component | 组件名 | Description | Since |',
          '|-----------|--------|-------------|-------|',
        ];
        for (const c of components) {
          const desc = c.description || c.descriptionZh || '';
          lines.push(`| **${c.name}** | ${c.nameZh} | ${desc} | ${c.since} |`);
        }
        console.log(lines.join('\n'));
        return;
      }

      // Text format
      const headers = ['Component', '组件名', 'Description', 'Since'];
      const rows = components.map((c) => [
        c.name,
        c.nameZh,
        c.description,
        c.since,
      ]);
      console.log(formatTable(headers, rows, 'text'));
    });
}
