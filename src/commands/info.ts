import type { Command } from 'commander';
import type { GlobalOptions, PropData, CLIError } from '../types.js';
import { localize } from '../types.js';
import { resolveComponent } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { printError } from '../output/error.js';
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

/**
 * Core function: get component info.
 * Returns component data or CLIError. Never writes to stdout.
 */
export function getComponentInfo(
  component: string,
  opts: { lang: string; version: string; detail: boolean },
): ComponentInfoConcise | ComponentInfoDetail | CLIError {
  const resolved = resolveComponent(component, opts.version);
  if ('error' in resolved) return resolved;
  const { comp } = resolved;

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

      // Text/markdown format — use result fields to avoid re-loading metadata
      const fmt = opts.format === 'markdown' ? 'markdown' : 'text';
      const nameLabel = result.nameZh ? `${result.name} (${result.nameZh})` : result.name;
      console.log(`${nameLabel} — ${result.description}`);
      if (opts.detail && 'whenToUse' in result && result.whenToUse) {
        console.log(`\nWhen to use: ${result.whenToUse}`);
      }
      console.log('');

      const headers = opts.detail
        ? ['Property', 'Type', 'Default', 'Since', 'Description']
        : ['Property', 'Type', 'Default', 'Since'];

      const rows: string[][] = result.props.map((p): string[] =>
        opts.detail && 'description' in p
          ? [p.name, p.type, p.default, p.since ?? '-', (p as { description: string }).description || '-']
          : [p.name, p.type, p.default, 'since' in p ? (p.since ?? '-') : '-'],
      );
      console.log(formatTable(headers, rows, fmt));

      if (result.subComponentProps) {
        for (const [subName, subProps] of Object.entries(result.subComponentProps)) {
          console.log(`\n${subName}`);
          console.log('');
          const subRows: string[][] = subProps.map((p): string[] => {
            const prop = p as { name: string; type: string; default: string; since?: string; description?: string };
            return opts.detail
              ? [prop.name, prop.type, prop.default, prop.since ?? '-', prop.description || '-']
              : [prop.name, prop.type, prop.default, prop.since ?? '-'];
          });
          console.log(formatTable(headers, subRows, fmt));
        }
      }

      if (opts.detail && 'related' in result && result.related.length > 0) {
        console.log(`\nRelated: ${result.related.join(', ')}`);
      }
    });
}
