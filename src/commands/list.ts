import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { localize } from '../types.js';
import { loadMetadata } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { formatTable, output } from '../output/formatter.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all components with descriptions and categories')
    .action(() => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadata(versionInfo.majorVersion);
      const lang = opts.lang;

      if (store.components.length === 0) {
        console.log('No component data available.');
        return;
      }

      if (opts.format === 'json') {
        const data = store.components.map((c) => ({
          name: c.name,
          category: localize(c.category, c.categoryZh, lang),
          description: localize(c.description, c.descriptionZh, lang),
        }));
        output(data, 'json');
        return;
      }

      // Group by category
      const categories = new Map<string, typeof store.components>();
      for (const comp of store.components) {
        const cat = localize(comp.category, comp.categoryZh, lang) || 'Other';
        if (!categories.has(cat)) categories.set(cat, []);
        categories.get(cat)!.push(comp);
      }

      if (opts.format === 'markdown') {
        const lines: string[] = [`# antd Components (${versionInfo.version})`, ''];
        for (const [category, components] of categories) {
          lines.push(`## ${category}`, '');
          for (const comp of components) {
            const desc = localize(comp.description, comp.descriptionZh, lang);
            lines.push(`- **${comp.name}** — ${desc}`);
          }
          lines.push('');
        }
        console.log(lines.join('\n'));
        return;
      }

      // Text format
      const headers = ['Component', 'Category', 'Description'];
      const rows = store.components.map((c) => [
        c.name,
        localize(c.category, c.categoryZh, lang),
        localize(c.description, c.descriptionZh, lang),
      ]);
      console.log(formatTable(headers, rows, 'text'));
    });
}
