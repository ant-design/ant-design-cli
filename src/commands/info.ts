import type { Command } from 'commander';
import type { GlobalOptions, PropData, CLIError } from '../types.js';
import { localize } from '../types.js';
import { loadMetadataForVersion, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { formatTable, output } from '../output/formatter.js';

export interface ComponentInfoConcise {
  name: string;
  nameZh: string;
  description: string;
  props: { name: string; type: string; default: string; since: string }[];
  subComponentProps?: Record<string, { name: string; type: string; default: string }[]>;
}

export interface ComponentInfoDetail {
  name: string;
  nameZh: string;
  description: string;
  whenToUse: string;
  props: (PropData & { description: string })[];
  subComponentProps?: Record<string, (PropData & { description: string })[]>;
  methods: { name: string; description: string; type: string }[];
  related: string[];
  faq: { question: string; answer: string }[];
}

function mapProps(props: PropData[], lang: string, detail: boolean) {
  return props.map((p) =>
    detail
      ? [p.name, p.type, p.default, p.since ?? '-', localize(p.description, p.descriptionZh, lang) || '-']
      : [p.name, p.type, p.default, p.since ?? '-'],
  );
}

/**
 * Core function: get component info.
 * Returns component data or CLIError. Never writes to stdout.
 */
export function getComponentInfo(
  component: string,
  opts: { lang: string; version: string; detail: boolean },
): ComponentInfoConcise | ComponentInfoDetail | CLIError {
  const store = loadMetadataForVersion(opts.version);
  const comp = findComponent(store, component);

  if (!comp) {
    const names = getAllComponentNames(store);
    const suggestion = fuzzyMatch(component, names);
    return createError(
      ErrorCodes.COMPONENT_NOT_FOUND,
      `Component '${component}' not found`,
      suggestion ? `Did you mean '${suggestion}'?` : undefined,
    );
  }

  const desc = localize(comp.description, comp.descriptionZh, opts.lang);
  const whenToUse = localize(comp.whenToUse, comp.whenToUseZh, opts.lang);

  if (opts.detail) {
    return {
      name: comp.name,
      nameZh: comp.nameZh ?? '',
      description: desc,
      whenToUse: whenToUse || '',
      props: comp.props.map((p) => ({
        ...p,
        description: localize(p.description, p.descriptionZh, opts.lang),
      })),
      subComponentProps: comp.subComponentProps
        ? Object.fromEntries(
            Object.entries(comp.subComponentProps).map(([name, props]) => [
              name,
              props.map((p) => ({ ...p, description: localize(p.description, p.descriptionZh, opts.lang) })),
            ]),
          )
        : undefined,
      methods: comp.methods || [],
      related: comp.related || [],
      faq: comp.faq || [],
    };
  }

  return {
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
  };
}

export function registerInfoCommand(program: Command): void {
  program
    .command('info <component>')
    .description('Query component API: props, type definitions, default values')
    .action((component: string) => {
      const opts = program.opts<GlobalOptions>();
      const lang = opts.lang;
      const versionInfo = detectVersion(opts.version);
      const result = getComponentInfo(component, {
        lang,
        version: versionInfo.version,
        detail: opts.detail,
      });

      if ('error' in result) {
        printError(result, opts.format);
        process.exitCode = 1;
        return;
      }

      if (opts.format === 'json') {
        output(result, 'json');
        return;
      }

      // Text/markdown format
      const fmt = opts.format === 'markdown' ? 'markdown' : 'text';
      const comp = findComponent(loadMetadataForVersion(versionInfo.version), component)!;
      const nameLabel = comp.nameZh ? `${comp.name} (${comp.nameZh})` : comp.name;
      const desc = localize(comp.description, comp.descriptionZh, lang);
      const whenToUse = localize(comp.whenToUse, comp.whenToUseZh, lang);
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
