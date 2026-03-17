import type { Command } from 'commander';
import type { GlobalOptions, PropData } from '../types.js';
import { localize } from '../types.js';
import { loadMetadataForVersion, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { formatTable, output } from '../output/formatter.js';

function mapProps(props: PropData[], lang: string, detail: boolean) {
  return props.map((p) =>
    detail
      ? [p.name, p.type, p.default, p.since ?? '-', localize(p.description, p.descriptionZh, lang) || '-']
      : [p.name, p.type, p.default, p.since ?? '-'],
  );
}

export function registerInfoCommand(program: Command): void {
  program
    .command('info <component>')
    .description('Query component API: props, type definitions, default values')
    .action((component: string) => {
      const opts = program.opts<GlobalOptions>();
      const lang = opts.lang;
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadataForVersion(versionInfo.version);
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
              nameZh: comp.nameZh ?? '',
              description: desc,
              whenToUse: whenToUse || '',
              props: comp.props.map((p) => ({
                ...p,
                description: localize(p.description, p.descriptionZh, lang),
              })),
              subComponentProps: comp.subComponentProps
                ? Object.fromEntries(
                    Object.entries(comp.subComponentProps).map(([name, props]) => [
                      name,
                      props.map((p) => ({ ...p, description: localize(p.description, p.descriptionZh, lang) })),
                    ]),
                  )
                : undefined,
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
              nameZh: comp.nameZh ?? '',
              description: desc,
              props: comp.props.map((p) => ({
                name: p.name,
                type: p.type,
                default: p.default,
                since: p.since ?? '',
              })),
              subComponentProps: comp.subComponentProps
                ? Object.fromEntries(
                    Object.entries(comp.subComponentProps).map(([name, props]) => [
                      name,
                      props.map((p) => ({ name: p.name, type: p.type, default: p.default })),
                    ]),
                  )
                : undefined,
            },
            'json',
          );
        }
        return;
      }

      // Text/markdown format
      const fmt = opts.format === 'markdown' ? 'markdown' : 'text';
      const nameLabel = comp.nameZh ? `${comp.name} (${comp.nameZh})` : comp.name;
      console.log(`${nameLabel} — ${desc}`);
      if (opts.detail && whenToUse) {
        console.log(`\nWhen to use: ${whenToUse}`);
      }
      console.log('');

      const headers = opts.detail
        ? ['Property', 'Type', 'Default', 'Since', 'Description']
        : ['Property', 'Type', 'Default', 'Since'];

      console.log(formatTable(headers, mapProps(comp.props, lang, opts.detail), fmt));

      if (comp.subComponentProps) {
        for (const [subName, subProps] of Object.entries(comp.subComponentProps)) {
          console.log(`\n${subName}`);
          console.log('');
          console.log(formatTable(headers, mapProps(subProps, lang, opts.detail), fmt));
        }
      }

      if (opts.detail && comp.related && comp.related.length > 0) {
        console.log(`\nRelated: ${comp.related.join(', ')}`);
      }
    });
}
