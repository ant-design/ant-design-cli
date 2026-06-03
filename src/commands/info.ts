import type { Command } from 'commander';
import type { GlobalOptions, PropData, CLIError } from '../types.js';
import { localize } from '../types.js';
import { resolveComponent } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { printError } from '../output/error.js';
import { formatTable, output } from '../output/formatter.js';

/** Common props inherited by most antd components via Common Props. */
const COMMON_PROPS: PropData[] = [
  { name: 'className', type: 'string', default: '-', description: 'Additional CSS class', descriptionZh: '额外的 CSS 类名' },
  { name: 'style', type: 'CSSProperties', default: '-', description: 'Additional style', descriptionZh: '额外的样式' },
  { name: 'rootClassName', type: 'string', default: '-', description: 'ClassName on the root element', descriptionZh: '根元素的类名' },
];

/** Components that do NOT support common props (no DOM element rendered). */
const COMMON_PROPS_EXCLUDED = new Set(['ConfigProvider']);

/**
 * Maps component names to their underlying HTML element.
 * Derived from antd source: forwardRef<HTMLXxxElement> / extends React.HTMLAttributes<HTMLXxxElement>.
 * Components not listed here default to 'div'.
 */
const HTML_ELEMENT_MAP: Record<string, string> = {
  Avatar: 'span',
  Badge: 'span',
  Button: 'button',
  Checkbox: 'input',
  FloatButton: 'button',
  Input: 'input',
  InputNumber: 'input',
  Mentions: 'textarea',
  Radio: 'input',
  Switch: 'button',
  Tag: 'span',
  Typography: 'span',
  Upload: 'span',
};

export interface ComponentInfoConcise {
  name: string;
  nameZh: string;
  description: string;
  props: { name: string; type: string; default: string; since: string }[];
  subComponentProps?: Record<string, { name: string; type: string; default: string; since: string }[]>;
  commonProps?: PropData[];
  htmlElement?: string;
}

export interface ComponentInfoDetail {
  name: string;
  nameZh: string;
  description: string;
  whenToUse: string;
  props: (PropData & { description: string })[];
  subComponentProps?: Record<string, (PropData & { description: string })[]>;
  commonProps?: PropData[];
  htmlElement?: string;
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
  const commonProps = COMMON_PROPS_EXCLUDED.has(comp.name) ? undefined : COMMON_PROPS;
  const htmlElement = COMMON_PROPS_EXCLUDED.has(comp.name)
    ? undefined
    : HTML_ELEMENT_MAP[comp.name] ?? 'div';

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
      commonProps,
      htmlElement,
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
            props.map((p) => ({ name: p.name, type: p.type, default: p.default, since: p.since ?? '' })),
          ]),
        )
      : undefined,
    commonProps,
    htmlElement,
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
        console.log(`\n${localize('When to use:', '使用场景：', opts.lang)} ${result.whenToUse}`);
      }
      console.log('');

      const headers = opts.detail
        ? ['Property', 'Type', 'Default', 'Since', 'Description']
        : ['Property', 'Type', 'Default', 'Since'];

      const rows: string[][] = result.props.map((p): string[] => {
        const s = ('since' in p && p.since) ? String(p.since) : '-';
        return opts.detail && 'description' in p
          ? [p.name, p.type, p.default, s, (p as { description: string }).description || '-']
          : [p.name, p.type, p.default, s];
      });
      console.log(formatTable(headers, rows, fmt));

      if (result.subComponentProps) {
        for (const [subName, subProps] of Object.entries(result.subComponentProps)) {
          console.log(`\n${subName}`);
          console.log('');
          const subRows: string[][] = subProps.map((p: { name: string; type: string; default: string; since?: string; description?: string }): string[] => {
            const prop = p as { name: string; type: string; default: string; since?: string; description?: string };
            return opts.detail
              ? [prop.name, prop.type, prop.default, prop.since || '-', prop.description || '-']
              : [prop.name, prop.type, prop.default, prop.since || '-'];
          });
          console.log(formatTable(headers, subRows, fmt));
        }
      }

      // Common props — most antd components inherit className/style/rootClassName via Common Props.
      // ConfigProvider does NOT support common props (no DOM element rendered).
      if (result.commonProps) {
        const noteLabel = localize(
          'Common Props (inherited by all components, not listed individually)',
          '通用属性（所有组件均支持，无需单独列出）',
          opts.lang,
        );
        console.log(`\n${noteLabel}`);
        console.log('');
        const cpHeaders = opts.detail
          ? ['Property', 'Type', 'Default', 'Description']
          : ['Property', 'Type', 'Default'];
        const cpRows: string[][] = result.commonProps.map((p: PropData) => {
          const desc = opts.detail ? localize(p.description, p.descriptionZh, opts.lang) || '-' : undefined;
          return opts.detail
            ? [p.name, p.type, p.default, desc!]
            : [p.name, p.type, p.default];
        });
        console.log(formatTable(cpHeaders, cpRows, fmt));

        if (result.htmlElement) {
          const extendsNote = localize(
            `\nExtends <${result.htmlElement}> — supports native HTML ${result.htmlElement} attributes.`,
            `\n扩展自 <${result.htmlElement}>，支持原生 HTML ${result.htmlElement} 属性。`,
            opts.lang,
          );
          console.log(extendsNote);
        }
      }
    });
}