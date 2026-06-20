import { parse as parseYaml } from 'yaml';

export interface ParsedFrontMatter {
  data: Record<string, unknown>;
  content: string;
}

function isDelimiter(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '---' || trimmed === '...';
}

export function parseFrontMatter(input: string): ParsedFrontMatter {
  const firstLineEnd = input.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? input : input.slice(0, firstLineEnd);

  if (firstLine.trim() !== '---') {
    return { data: {}, content: input };
  }

  let lineStart = firstLineEnd + 1;
  while (lineStart <= input.length) {
    const lineEnd = input.indexOf('\n', lineStart);
    const end = lineEnd === -1 ? input.length : lineEnd;
    const line = input.slice(lineStart, end);

    if (isDelimiter(line)) {
      const yamlSource = input.slice(firstLineEnd + 1, lineStart);
      const parsed = yamlSource.trim() ? parseYaml(yamlSource) : {};
      const contentStart = lineEnd === -1 ? input.length : lineEnd + 1;

      return {
        data: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {},
        content: input.slice(contentStart),
      };
    }

    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
  }

  return { data: {}, content: input };
}
