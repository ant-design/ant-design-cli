import type { OutputFormat, TokenData } from '../types.js';
import { localize } from '../types.js';

export interface TokenOutputOptions {
  format: OutputFormat;
  lang: string;
}

export interface GlobalTokensResult {
  tokens: TokenData[];
}

export interface ComponentTokensResult {
  component: string;
  tokens: TokenData[];
}

/** Output token data in the specified format */
export function outputTokens(
  result: GlobalTokensResult | ComponentTokensResult,
  options: TokenOutputOptions,
): void {
  const { format, lang } = options;

  // JSON handles both cases uniformly
  if (format === 'json') {
    output(result, 'json');
    return;
  }

  const isEmpty = result.tokens.length === 0;
  const isComponent = 'component' in result;

  // Handle empty tokens
  if (isEmpty) {
    const emptyMsg = isComponent
      ? localize(
          `No component tokens available for ${result.component}.`,
          `${result.component} 组件暂无可用 Token。`,
          lang,
        )
      : localize('No global token data available.', '暂无全局 Token 数据。', lang);
    console.log(emptyMsg);
    return;
  }

  // Table output for text/markdown
  const title = isComponent
    ? localize(
        `${result.component} Component Tokens:`,
        `${result.component} 组件 Token：`,
        lang,
      )
    : localize('Global Design Tokens:', '全局 Design Tokens：', lang);
  console.log(title);
  console.log('');

  const headers = isComponent
    ? [
        localize('Token', 'Token', lang),
        localize('Type', '类型', lang),
        localize('Default', '默认值', lang),
      ]
    : [
        localize('Token', 'Token', lang),
        localize('Type', '类型', lang),
        localize('Default', '默认值', lang),
        localize('Description', '描述', lang),
      ];

  const rows = result.tokens.map((t) =>
    isComponent
      ? [t.name, t.type, t.default]
      : [t.name, t.type, t.default, localize(t.description, t.descriptionZh, lang) || '-'],
  );

  console.log(formatTable(headers, rows, format === 'markdown' ? 'markdown' : 'text'));
}

function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'markdown':
      return formatAsMarkdown(data);
    case 'text':
    default:
      return formatAsText(data);
  }
}

function formatAsText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map((item) => formatAsText(item)).join('\n');
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map((v) => `  ${formatAsText(v)}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');
  }
  return String(data);
}

function formatAsMarkdown(data: unknown): string {
  if (typeof data === 'string') return data;
  if (typeof data === 'object' && data !== null) {
    return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
  }
  return String(data);
}

export function formatTable(
  headers: string[],
  rows: string[][],
  format: OutputFormat,
): string {
  if (format === 'json') {
    return JSON.stringify(
      rows.map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      }),
      null,
      2,
    );
  }

  if (format === 'markdown') {
    // Escape pipe characters in cell content to avoid breaking markdown tables
    const escPipe = (s: string) => s.replace(/\|/g, '\\|');
    const headerLine = '| ' + headers.map(escPipe).join(' | ') + ' |';
    const separator = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const bodyLines = rows.map((row) => '| ' + row.map(escPipe).join(' | ') + ' |');
    return [headerLine, separator, ...bodyLines].join('\n');
  }

  // Text format: aligned columns
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length)),
  );
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
  const separator = colWidths.map((w) => '-'.repeat(w)).join('  ');
  const bodyLines = rows.map((row) =>
    row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('  '),
  );
  return [headerLine, separator, ...bodyLines].join('\n');
}

export function output(data: unknown, format: OutputFormat): void {
  console.log(formatOutput(data, format));
}
