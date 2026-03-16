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

/** Extract API table from markdown content and parse into PropData[] */
function parseApiTable(content: string, lang: 'en' | 'zh'): PropData[] {
  const props: PropData[] = [];

  // Find the ## API section
  const apiMatch = content.match(/^## API/m);
  if (!apiMatch || apiMatch.index === undefined) return props;

  const afterApi = content.slice(apiMatch.index);

  // Find all markdown tables in the API section (stop at next ## heading)
  const nextSection = afterApi.match(/\n## (?!API)/m);
  const apiContent = nextSection?.index !== undefined ? afterApi.slice(0, nextSection.index) : afterApi;

  // Match table blocks (header + separator + rows)
  const tableRegex = /\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.+\|\n?)*)/g;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(apiContent)) !== null) {
    const headerRow = parseTableRow(tableMatch[0].split('\n')[0]);
    const rows = tableMatch[2].trim().split('\n');

    // Determine column indices based on header
    const descIdx = lang === 'zh'
      ? headerRow.findIndex((h) => h === '说明' || h === '描述')
      : headerRow.findIndex((h) => h === 'Description');
    const typeIdx = headerRow.findIndex((h) => h === 'Type' || h === '类型');
    const defaultIdx = headerRow.findIndex((h) => h === 'Default' || h === '默认值');
    const versionIdx = headerRow.findIndex((h) => h === 'Version' || h === '版本');
    const nameIdx = headerRow.findIndex((h) => h === 'Property' || h === '属性' || h === 'Name' || h === '参数' || h === 'Option' || h === '字段');

    if (nameIdx === -1) continue;

    for (const row of rows) {
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
  }

  return props;
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

/** Extract props for a component from its markdown docs */
export function extractProps(antdDir: string, dirName: string): PropData[] {
  const enPath = path.join(antdDir, 'components', dirName, 'index.en-US.md');
  const zhPath = path.join(antdDir, 'components', dirName, 'index.zh-CN.md');

  if (!fs.existsSync(enPath)) return [];

  const enContent = matter(fs.readFileSync(enPath, 'utf-8')).content;
  const enProps = parseApiTable(enContent, 'en');

  if (fs.existsSync(zhPath)) {
    const zhContent = matter(fs.readFileSync(zhPath, 'utf-8')).content;
    const zhProps = parseApiTable(zhContent, 'zh');
    return mergeProps(enProps, zhProps);
  }

  return enProps;
}
