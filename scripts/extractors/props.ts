import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { PropData } from '../../src/types.js';

/** Parse a markdown table row into cells, handling escaped pipes */
function parseTableRow(row: string): string[] {
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Detect if a prop name indicates deprecation (~~name~~) */
function parseDeprecation(name: string): { cleanName: string; deprecated: boolean | string } {
  const strikethrough = name.match(/^~~(.+?)~~$/);
  if (strikethrough) {
    return { cleanName: strikethrough[1], deprecated: true };
  }
  return { cleanName: name, deprecated: false };
}

/** Parse all props from a single markdown table block */
function parseTable(tableText: string, lang: 'en' | 'zh'): PropData[] {
  const props: PropData[] = [];
  const lines = tableText.trim().split('\n');
  if (lines.length < 3) return props;

  const headerRow = parseTableRow(lines[0]);
  const descIdx = lang === 'zh'
    ? headerRow.findIndex((h) => h === '说明' || h === '描述')
    : headerRow.findIndex((h) => h === 'Description');
  const typeIdx = headerRow.findIndex((h) => h === 'Type' || h === '类型');
  const defaultIdx = headerRow.findIndex((h) => h === 'Default' || h === '默认值');
  const versionIdx = headerRow.findIndex((h) => h === 'Version' || h === '版本');
  const nameIdx = headerRow.findIndex((h) => h === 'Property' || h === '属性' || h === 'Name' || h === '参数' || h === 'Option' || h === '字段');

  if (nameIdx === -1) return props;

  for (let i = 2; i < lines.length; i++) {
    const row = lines[i];
    if (!row.trim()) continue;
    const cells = parseTableRow(row);

    const rawName = cells[nameIdx] || '';
    const { cleanName, deprecated } = parseDeprecation(rawName);
    if (!cleanName) continue;

    const prop: PropData = {
      name: cleanName,
      type: cells[typeIdx] || '',
      default: cells[defaultIdx] || '-',
    };

    const desc = descIdx >= 0 ? cells[descIdx] : '';
    if (lang === 'zh') {
      prop.descriptionZh = desc;
    } else {
      prop.description = desc;
    }

    if (versionIdx >= 0 && cells[versionIdx]) {
      prop.since = cells[versionIdx];
    }

    if (deprecated) {
      prop.deprecated = deprecated;
    }

    props.push(prop);
  }

  return props;
}

/**
 * Split the API section into sub-sections by ### headings.
 * Returns a map of heading label → props array.
 */
function parseApiSections(content: string, lang: 'en' | 'zh'): Map<string, PropData[]> {
  const sections = new Map<string, PropData[]>();

  // Find the ## API section
  const apiMatch = content.match(/^## API/m);
  if (!apiMatch || apiMatch.index === undefined) return sections;

  const afterApi = content.slice(apiMatch.index);

  // Stop at next ## heading (not ###)
  const nextSection = afterApi.match(/\n## (?!API)/m);
  const apiContent = nextSection?.index !== undefined ? afterApi.slice(0, nextSection.index) : afterApi;

  // Split by ### headings; first part (before any ###) has label '__main__'
  const parts = apiContent.split(/^(?=### )/m);

  for (const part of parts) {
    const headingMatch = part.match(/^### (.+)$/m);
    const label = headingMatch ? headingMatch[1].trim() : '__main__';

    const tableRegex = /\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.+\|\n?)*)/g;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(part)) !== null) {
      const tableProps = parseTable(tableMatch[0], lang);
      if (tableProps.length > 0) {
        const existing = sections.get(label) || [];
        sections.set(label, [...existing, ...tableProps]);
      }
    }
  }

  return sections;
}

/** Merge English and Chinese props into bilingual PropData[] */
function mergeProps(enProps: PropData[], zhProps: PropData[]): PropData[] {
  const zhMap = new Map(zhProps.map((p) => [p.name, p]));

  return enProps.map((enProp) => {
    const zhProp = zhMap.get(enProp.name);
    return {
      ...enProp,
      descriptionZh: zhProp?.descriptionZh || zhProp?.description || '',
    };
  });
}

export interface PropsExtractResult {
  /** Main component props */
  props: PropData[];
  /** Sub-component props keyed by full name e.g. "Splitter.Panel" */
  subComponentProps: Record<string, PropData[]>;
}

/**
 * Extract props for a component from its markdown docs.
 * Separates main component props from sub-component (e.g. Panel) props.
 */
export function extractProps(antdDir: string, dirName: string, componentName: string): PropsExtractResult {
  const enPath = path.join(antdDir, 'components', dirName, 'index.en-US.md');
  const zhPath = path.join(antdDir, 'components', dirName, 'index.zh-CN.md');

  if (!fs.existsSync(enPath)) return { props: [], subComponentProps: {} };

  const enContent = matter(fs.readFileSync(enPath, 'utf-8')).content;
  const enSections = parseApiSections(enContent, 'en');

  let zhSections = new Map<string, PropData[]>();
  if (fs.existsSync(zhPath)) {
    const zhContent = matter(fs.readFileSync(zhPath, 'utf-8')).content;
    zhSections = parseApiSections(zhContent, 'zh');
  }

  const result: PropsExtractResult = { props: [], subComponentProps: {} };

  for (const [label, enProps] of enSections) {
    const zhProps = zhSections.get(label) || [];
    const merged = mergeProps(enProps, zhProps);

    // Main section: matches component name (case-insensitive) or is the pre-### fallback
    const isMain =
      label === '__main__' ||
      label.toLowerCase() === componentName.toLowerCase();

    if (isMain) {
      result.props = [...result.props, ...merged];
    } else {
      // Qualify as "ComponentName.Label" unless already qualified
      const fullName = label.includes('.')
        ? label
        : `${componentName}.${label}`;
      result.subComponentProps[fullName] = [
        ...(result.subComponentProps[fullName] || []),
        ...merged,
      ];
    }
  }

  return result;
}
