import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { localize } from '../types.js';
import { loadMetadata, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { formatTable, output } from '../output/formatter.js';

export function registerInfoCommand(program: Command): void {
  program
    .command('info <component>')
    .description('Query component API: props, type definitions, default values')
    .action((component: string) => {
      const opts = program.opts<GlobalOptions>();
      const lang = opts.lang;
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadata(versionInfo.majorVersion);
      const comp = findComponent(store, component);

      if (!comp) {
        const names = getAllComponentNames(store);
        const suggestion = fuzzyMatch(component, names);
        const err = createError(
          ErrorCodes.COMPONENT_NOT_FOUND,
          `Component '${component}' not found`,
          suggestion ? `Did you mean '${suggestion}'?` : undefined,
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      const desc = localize(comp.description, comp.descriptionZh, lang);
      const whenToUse = localize(comp.whenToUse, comp.whenToUseZh, lang);

      if (opts.format === 'json') {
        if (opts.detail) {
          output(
            {
              name: comp.name,
              description: desc,
              whenToUse: whenToUse || '',
              props: comp.props.map((p) => ({
                ...p,
                description: localize(p.description, p.descriptionZh, lang),
              })),
              methods: comp.methods || [],
              related: comp.related || [],
              faq: comp.faq || [],
            },
            'json',
          );
        } else {
          output(
            {
              name: comp.name,
              description: desc,
              props: comp.props.map((p) => ({
                name: p.name,
                type: p.type,
                default: p.default,
              })),
            },
            'json',
          );
        }
        return;
      }

      // Text/markdown format
      console.log(`${comp.name} — ${desc}`);
      if (opts.detail && whenToUse) {
        console.log(`\nWhen to use: ${whenToUse}`);
      }
      console.log('');

      const headers = opts.detail
        ? ['Property', 'Type', 'Default', 'Description']
        : ['Property', 'Type', 'Default'];

      const rows = comp.props.map((p) =>
        opts.detail
          ? [p.name, p.type, p.default, localize(p.description, p.descriptionZh, lang) || '-']
          : [p.name, p.type, p.default],
      );

      console.log(formatTable(headers, rows, opts.format === 'markdown' ? 'markdown' : 'text'));

      if (opts.detail && comp.related && comp.related.length > 0) {
        console.log(`\nRelated: ${comp.related.join(', ')}`);
      }
    });
}
