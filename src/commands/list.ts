import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { loadMetadataForVersion } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { formatTable, output } from '../output/formatter.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all components with bilingual names, descriptions, and first-supported version')
    .action(() => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadataForVersion(versionInfo.version);

      if (store.components.length === 0) {
        console.log('No component data available.');
        return;
      }

      if (opts.format === 'json') {
        const data = store.components.map((c) => ({
          name: c.name,
          nameZh: c.nameZh ?? '',
          description: c.description,
          descriptionZh: c.descriptionZh ?? '',
          since: c.since ?? '',
        }));
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
        for (const c of store.components) {
          const desc = c.description || c.descriptionZh || '';
          lines.push(`| **${c.name}** | ${c.nameZh ?? ''} | ${desc} | ${c.since ?? ''} |`);
        }
        console.log(lines.join('\n'));
        return;
      }

      // Text format
      const headers = ['Component', '组件名', 'Description', 'Since'];
      const rows = store.components.map((c) => [
        c.name,
        c.nameZh ?? '',
        c.description,
        c.since ?? '',
      ]);
      console.log(formatTable(headers, rows, 'text'));
    });
}
