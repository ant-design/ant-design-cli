import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { PropData } from '../../src/types.js';

/** Parse a markdown table row into cells, handling escaped pipes (`\|`) */
export function parseTableRow(row: string): string[] {
  const PIPE = '\x00PIPE\x00';
  return row
    .replace(/\\\|/g, PIPE)   // protect \| before splitting
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim().replace(new RegExp(PIPE, 'g'), '|'));
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
  // "Param" used in some components (e.g. Menu) alongside the standard "Property"
  const nameIdx = headerRow.findIndex((h) =>
    h === 'Property' || h === '属性' ||
    h === 'Name' || h === '参数' ||
    h === 'Option' || h === '字段' ||
    h === 'Param'
  );

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
 * Strip markdown / HTML noise from a heading label.
 * e.g. "Avatar.Group <Badge>4.5.0+</Badge>" → "Avatar.Group"
 *      "useConfig() <Badge>5.3.0+</Badge> {#useconfig}" → "useConfig()"
 *      "RequestOptions {#request-options}" → "RequestOptions"
 */
function cleanLabel(raw: string): string {
  return raw
    .replace(/<Badge>[^<]*<\/Badge>/gi, '')   // strip <Badge>...</Badge>
    .replace(/\{#[^}]+\}/g, '')               // strip {#anchor} fragments
    .trim();
}

/**
 * Determine whether a section heading represents the main component props.
 *
 * Handles naming conventions found across antd's markdown docs:
 *   - Exact: "Splitter" → main for Splitter
 *   - With suffix: "Select props", "Anchor Props", "Tree props" → main
 *   - Slash variants: "Radio/Radio.Button" → main for Radio
 *   - Singular/plural: "Mention" → main for Mentions
 *   - Prefix match with suffix: "Tree props" → main for TreeSelect
 *   - Generic phrase: "common API" → main
 */
function isMainSection(label: string, componentName: string): boolean {
  if (label === '__main__') return true;

  const lcLabel = label.toLowerCase();
  const lcName = componentName.toLowerCase();

  // Exact match
  if (lcLabel === lcName) return true;

  // Strip common suffixes to get the base topic word(s)
  const lcBase = lcLabel
    .replace(/\s+(props?|api|options?|config(?:uration)?|ref|methods?|types?)$/, '')
    .trim();

  // Base exactly matches component name: "Select props" → "select" === "select"
  if (lcBase === lcName) return true;

  // Base is a prefix of component name (handles "Tree props" for "TreeSelect")
  // Require at least 4 chars to avoid spurious matches
  if (lcBase.length >= 4 && lcName.startsWith(lcBase)) return true;

  // Component name starts with the label: singular/plural "Mention" for "Mentions"
  if (lcName.startsWith(lcLabel) && lcLabel.length >= lcName.length - 2) return true;

  // Slash format: "Radio/Radio.Button" → first part is the component name
  if (lcLabel.startsWith(lcName + '/')) return true;

  // Generic phrases that always describe the main component
  if (/^common\s+(api|props?|options?)$/i.test(label)) return true;

  return false;
}

/** Extract all tables from a block of text and accumulate props */
function extractTablesFromBlock(block: string, lang: 'en' | 'zh'): PropData[] {
  const result: PropData[] = [];
  const tableRegex = /\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.+\|\n?)*)/g;
  let m;
  while ((m = tableRegex.exec(block)) !== null) {
    result.push(...parseTable(m[0], lang));
  }
  return result;
}

/**
 * Split the API documentation into per-section prop arrays.
 *
 * Scans from "## API" through all intermediate ## sections until it hits a
 * terminal section (Design Token, FAQ, Note, Examples, When To Use).
 * Within each block, ### headings create named sub-sections; content
 * appearing before the first ### belongs to the ## heading itself.
 *
 * Returns a Map<label, PropData[]>.
 */
function parseApiSections(content: string, lang: 'en' | 'zh'): Map<string, PropData[]> {
  const sections = new Map<string, PropData[]>();

  // Find the start of ## API
  const apiMatch = content.match(/^## API\b/m);
  if (!apiMatch || apiMatch.index === undefined) return sections;

  const afterApi = content.slice(apiMatch.index);

  // Stop at terminal ## sections that never contain API tables
  const terminalRe = /^## (?:Design Token|FAQ|Note|Examples?|When To Use|When to use|Best Practices?|Semantic DOM)\b/im;
  const terminalMatch = afterApi.match(terminalRe);
  const apiBlock = terminalMatch?.index !== undefined
    ? afterApi.slice(0, terminalMatch.index)
    : afterApi;

  // Split the whole API block by ## headings (level 2)
  // Each chunk is one ## section; first chunk is the "## API" section itself
  const h2Chunks = apiBlock.split(/^(?=## )/m).filter(Boolean);

  for (const chunk of h2Chunks) {
    // Determine this chunk's ## heading label
    const h2Match = chunk.match(/^## (.+)$/m);
    const rawH2 = h2Match ? h2Match[1].trim() : 'API';
    // "API" itself is treated as the root section (no sub-component label)
    const h2Label = rawH2 === 'API' ? '__api_root__' : cleanLabel(rawH2);

    // Split the chunk by ### headings
    const h3Parts = chunk.split(/^(?=### )/m);

    for (const part of h3Parts) {
      const h3Match = part.match(/^### (.+)$/m);

      let sectionLabel: string;
      if (!h3Match) {
        // Content before any ###: belongs to the ## heading
        sectionLabel = h2Label === '__api_root__' ? '__main__' : h2Label;
      } else {
        // Content under a ### heading
        sectionLabel = cleanLabel(h3Match[1].trim());
      }

      const props = extractTablesFromBlock(part, lang);
      if (props.length > 0) {
        const existing = sections.get(sectionLabel) || [];
        sections.set(sectionLabel, [...existing, ...props]);
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
  /** Sub-component / sub-type props keyed by qualified name e.g. "Splitter.Panel" */
  subComponentProps: Record<string, PropData[]>;
}

/**
 * Extract props for a component from its markdown docs.
 * Separates main props from sub-component / sub-type sections.
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

    if (isMainSection(label, componentName)) {
      result.props = [...result.props, ...merged];
    } else {
      // Qualify as "ComponentName.Label" unless it already contains a dot
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
