import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { localize } from '../types.js';
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
        if (opts.format === 'json') {
          output([], 'json');
        } else {
          console.log(localize('No component data available.', '没有可用的组件数据。', opts.lang));
        }
        return;
      }

      if (opts.format === 'json') {
        output(components, 'json');
        return;
      }

      const headers = opts.lang === 'zh'
        ? ['组件', '中文名', '描述', '版本']
        : ['Component', 'Name (zh)', 'Description', 'Since'];
      const rows = components.map((c) => [
        c.name,
        c.nameZh,
        localize(c.description, c.descriptionZh, opts.lang),
        c.since,
      ]);

      if (opts.format === 'markdown') {
        console.log(`# antd Components (${versionInfo.version})`);
        console.log('');
        console.log(formatTable(headers, rows, 'markdown'));
        return;
      }

      // Text format
      console.log(formatTable(headers, rows, 'text'));
    });
}
