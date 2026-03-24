import type { OutputFormat } from '../types.js';

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
