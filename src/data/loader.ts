import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MetadataStore, ComponentData, PropData, CLIError } from '../types.js';
import { createError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { readJson } from '../utils/json.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedDataPath: string | undefined;

function getDataPath(): string {
  if (cachedDataPath) return cachedDataPath;
  // Check for a known file to confirm the correct directory
  // Works from both dist/ and src/data/
  // Probe for both .json.gz (published package) and .json (local dev) formats
  const candidates = [
    join(__dirname, '..', 'data'),       // from dist/
    join(__dirname, '..', '..', 'data'), // from src/data/
  ];
  cachedDataPath = candidates.find((p) =>
    existsSync(join(p, 'v5.json.gz')) || existsSync(join(p, 'v5.json'))
  ) ?? candidates[0];
  return cachedDataPath;
}

/** Read a JSON data file, supporting both .json.gz and plain .json formats. */
function readDataFile(filePath: string): string {
  const gzPath = filePath + '.gz';
  /* v8 ignore next 3 -- gz files only present in production builds */
  if (existsSync(gzPath)) {
    return gunzipSync(readFileSync(gzPath)).toString('utf-8');
  }
  return readFileSync(filePath, 'utf-8');
}

/** Deduplicate props by name (keep first occurrence). */
function normalizeStore(store: MetadataStore): MetadataStore {
  for (const comp of store.components) {
    const seen = new Set<string>();
    comp.props = comp.props.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }
  return store;
}

/**
 * Load the bundled `design.md` — a hand-curated design-language document
 * (YAML front-matter + prose) describing antd's default light theme,
 * conformant with the google-labs-code/design.md spec.
 *
 * Returns the raw markdown, or null if the file is missing.
 */
export function loadDesignDoc(): string | null {
  const designPath = join(getDataPath(), 'design.md');
  try {
    if (!existsSync(designPath)) return null;
    return readFileSync(designPath, 'utf-8');
    /* v8 ignore next 3 -- defensive: bundled design.md is always readable */
  } catch {
    return null;
  }
}

export function loadMetadata(majorVersion: string): MetadataStore {
  const dataPath = join(getDataPath(), `${majorVersion}.json`);
  try {
    return normalizeStore(JSON.parse(readDataFile(dataPath)) as MetadataStore);
  } catch (err) /* v8 ignore start */ {
    if (err instanceof SyntaxError) {
      process.stderr.write(`[antd-cli] Warning: data file may be corrupted: ${dataPath}\n`);
    }
    return {
      version: majorVersion,
      majorVersion,
      components: [],
    };
  } /* v8 ignore stop */
}

/**
 * Load metadata for the most accurate historical snapshot matching the given full semver version.
 *
 * Resolution order:
 * 1. Exact minor match in versions.json  (e.g. "4.3" → "4.3.4" → data/v4.3.4.json)
 * 2. Nearest earlier minor               (e.g. requested 4.2.5 but only 4.1.x exists → use 4.1.x)
 * 3. Fall back to loadMetadata(majorVersion) (i.e. data/v4.json)
 */
const metadataCache = new Map<string, MetadataStore>();

export function loadMetadataForVersion(version: string): MetadataStore {
  const cached = metadataCache.get(version);
  if (cached) return cached;

  const result = loadMetadataForVersionUncached(version);
  metadataCache.set(version, result);
  return result;
}

function loadMetadataForVersionUncached(version: string): MetadataStore {
  const parts = version.split('.');
  const major = parts[0];
  const majorVersion = `v${major}`;

  // If not a recognisable major.minor.patch string, fall back immediately
  if (!parts[1]) {
    return loadMetadata(majorVersion);
  }

  const minorKey = `${major}.${parts[1]}`; // e.g. "4.3"

  // Load versions index
  const versionsPath = join(getDataPath(), 'versions.json');
  const versionsIndex = readJson<Record<string, Record<string, string>>>(versionsPath);
  if (!versionsIndex) {
    return loadMetadata(majorVersion);
  }

  const majorIndex = versionsIndex[majorVersion] ?? {};

  // Helper: try to load a snapshot by tag string (e.g. "4.3.4")
  function tryLoadSnapshot(tag: string): MetadataStore | null {
    const snapshotPath = join(getDataPath(), `v${tag}.json`);
    if (!existsSync(snapshotPath) && !existsSync(snapshotPath + '.gz')) return null;
    try {
      return normalizeStore(JSON.parse(readDataFile(snapshotPath)) as MetadataStore);
      /* v8 ignore start -- defensive: bundled snapshot files are always valid JSON */
    } catch {
      return null;
    }
    /* v8 ignore stop */
  }

  // 1. Exact minor match
  if (majorIndex[minorKey]) {
    const result = tryLoadSnapshot(majorIndex[minorKey]);
    if (result) return result;
  }

  // 2. Nearest earlier minor
  const requestedMinor = parseInt(parts[1], 10);
  const availableMinors = Object.keys(majorIndex)
    .filter((k) => k.startsWith(`${major}.`))
    .sort((a, b) => parseInt(a.split('.')[1], 10) - parseInt(b.split('.')[1], 10));

  let bestMinorKey: string | undefined;
  for (const m of availableMinors) {
    if (parseInt(m.split('.')[1], 10) <= requestedMinor) {
      bestMinorKey = m;
    }
  }

  if (bestMinorKey && majorIndex[bestMinorKey]) {
    const result = tryLoadSnapshot(majorIndex[bestMinorKey]);
    if (result) return result;
  }

  // 3. Fall back to latest major snapshot
  return loadMetadata(majorVersion);
}

export function findComponent(
  store: MetadataStore,
  name: string,
): ComponentData | undefined {
  return store.components.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
}

export function getAllComponentNames(store: MetadataStore): string[] {
  return store.components.map((c) => c.name);
}

// ---------------------------------------------------------------------------
// Runtime backfill: parse props from doc markdown when snapshot data is empty
// ---------------------------------------------------------------------------

/** Parse a markdown table row into cells, handling escaped pipes. */
function parseTableRow(row: string): string[] {
  const PIPE = '\x00PIPE\x00';
  return row
    .replace(/\\\|/g, PIPE)
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) =>
      cell
        .trim()
        .replace(new RegExp(PIPE, 'g'), '|')
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\</g, '<')
        .replace(/\\>/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    );
}

/** Parse props from a single markdown API table. */
function parseTableProps(tableText: string, lang: 'en' | 'zh'): PropData[] {
  const lines = tableText.trim().split('\n');
  if (lines.length < 3) return [];

  const header = parseTableRow(lines[0]);
  const descIdx =
    lang === 'zh'
      ? header.findIndex((h) => h === '说明' || h === '描述')
      : header.findIndex((h) => h === 'Description');
  const typeIdx = header.findIndex((h) => h === 'Type' || h === '类型');
  const defaultIdx = header.findIndex((h) => h === 'Default' || h === '默认值');
  const versionIdx = header.findIndex((h) => h === 'Version' || h === '版本');
  const nameIdx = header.findIndex((h) =>
    h === 'Property' || h === '属性' || h === 'Name' || h === '参数' || h === 'Option' || h === '字段' || h === 'Param' || h === 'Props' || h === 'Argument',
  );

  if (nameIdx === -1) {
    // Fallback: assume first column is the prop name (matches extraction script behavior)
    return parseTablePropsRows(lines, lang, 0, descIdx, typeIdx, defaultIdx, versionIdx);
  }

  return parseTablePropsRows(lines, lang, nameIdx, descIdx, typeIdx, defaultIdx, versionIdx);
}

/** Parse table rows given resolved column indices. */
function parseTablePropsRows(
  lines: string[],
  lang: 'en' | 'zh',
  nameIdx: number,
  descIdx: number,
  typeIdx: number,
  defaultIdx: number,
  versionIdx: number,
): PropData[] {
  const props: PropData[] = [];
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseTableRow(lines[i]);
    const rawName = cells[nameIdx] || '';
    const strikethrough = rawName.match(/^~~(.+?)~~$/);
    const cleanName = strikethrough ? strikethrough[1] : rawName;
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

    if (versionIdx >= 0 && cells[versionIdx]) prop.since = cells[versionIdx];
    if (strikethrough) prop.deprecated = true;

    props.push(prop);
  }
  return props;
}

/**
 * Strip heading noise like "<Badge>4.5.0+</Badge>" and "{#anchor}".
 */
function cleanLabel(raw: string): string {
  return raw
    .replace(/<Badge>[^<]*<\/Badge>/gi, '')
    .replace(/\{#[^}]+\}/g, '')
    .trim();
}

/**
 * Determine whether a heading represents the main component's props.
 */
function isMainSection(label: string, componentName: string): boolean {
  if (label === '__main__') return true;
  const lcLabel = label.toLowerCase();
  const lcName = componentName.toLowerCase();
  if (lcLabel === lcName) return true;

  const lcBase = lcLabel
    .replace(/\s+(props?|api|options?|config(?:uration)?|ref|methods?|types?)$/, '')
    .trim();
  if (lcBase === lcName) return true;
  if (lcBase.length >= 4 && lcName.startsWith(lcBase)) return true;
  if (lcName.startsWith(lcLabel) && lcLabel.length >= lcName.length - 2) return true;
  if (lcLabel.startsWith(lcName + '/')) return true;
  if (/^common\s+(api|props?|options?)$/i.test(label)) return true;

  return false;
}

/**
 * Parse props from the `doc`/`docZh` markdown fields of a component.
 * Returns { props, subComponentProps } or null if no API section found.
 *
 * Exported for testing. Not part of the public CLI API.
 */
export function parsePropsFromDoc(comp: ComponentData): { props: PropData[]; subComponentProps: Record<string, PropData[]> } | null {
  if (!comp.doc) return null;

  const apiMatch = comp.doc.match(/^## API\b/m);
  if (!apiMatch || apiMatch.index === undefined) return null;

  const afterApi = comp.doc.slice(apiMatch.index);
  const terminalRe = /^## (?:Design Token|FAQ|Note|Examples?|When To Use|When to use|Best Practices?|Semantic DOM)\b/im;
  const terminalMatch = afterApi.match(terminalRe);
  const apiBlock = terminalMatch?.index !== undefined ? afterApi.slice(0, terminalMatch.index) : afterApi;

  // Parse English props
  const enSections = new Map<string, PropData[]>();
  const tableRegex = /\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.+\|\n?)*)/g;
  const h2Chunks = apiBlock.split(/^(?=## )/m).filter(Boolean);

  for (const chunk of h2Chunks) {
    const h2Match = chunk.match(/^## (.+)$/m);
    const rawH2 = h2Match ? h2Match[1].trim() : 'API';
    const h2Label = rawH2 === 'API' ? '__api_root__' : cleanLabel(rawH2);
    const h3Parts = chunk.split(/^(?=### )/m);

    for (const part of h3Parts) {
      const h3Match = part.match(/^### (.+)$/m);
      const sectionLabel = !h3Match
        ? h2Label === '__api_root__' ? '__main__' : h2Label
        : cleanLabel(h3Match[1].trim());

      let m: RegExpExecArray | null;
      tableRegex.lastIndex = 0;
      while ((m = tableRegex.exec(part)) !== null) {
        const parsed = parseTableProps(m[0], 'en');
        if (parsed.length > 0) {
          const existing = enSections.get(sectionLabel) || [];
          enSections.set(sectionLabel, [...existing, ...parsed]);
        }
      }
    }
  }

  // Parse Chinese props
  const zhSections = new Map<string, PropData[]>();
  if (comp.docZh) {
    const zhApiMatch = comp.docZh.match(/^## API\b/m);
    if (zhApiMatch?.index !== undefined) {
      const zhAfterApi = comp.docZh.slice(zhApiMatch.index);
      const zhTerminal = zhAfterApi.match(terminalRe);
      const zhBlock = zhTerminal?.index !== undefined ? zhAfterApi.slice(0, zhTerminal.index) : zhAfterApi;
      const zhH2Chunks = zhBlock.split(/^(?=## )/m).filter(Boolean);

      for (const chunk of zhH2Chunks) {
        const h2Match = chunk.match(/^## (.+)$/m);
        const rawH2 = h2Match ? h2Match[1].trim() : 'API';
        const h2Label = rawH2 === 'API' ? '__api_root__' : cleanLabel(rawH2);
        const h3Parts = chunk.split(/^(?=### )/m);

        for (const part of h3Parts) {
          const h3Match = part.match(/^### (.+)$/m);
          const sectionLabel = !h3Match
            ? h2Label === '__api_root__' ? '__main__' : h2Label
            : cleanLabel(h3Match[1].trim());

          let m: RegExpExecArray | null;
          tableRegex.lastIndex = 0;
          while ((m = tableRegex.exec(part)) !== null) {
            const parsed = parseTableProps(m[0], 'zh');
            if (parsed.length > 0) {
              const existing = zhSections.get(sectionLabel) || [];
              zhSections.set(sectionLabel, [...existing, ...parsed]);
            }
          }
        }
      }
    }
  }

  if (enSections.size === 0) return null;

  // Merge English + Chinese and separate main / sub-component
  const props: PropData[] = [];
  const subComponentProps: Record<string, PropData[]> = {};

  for (const [label, enProps] of enSections) {
    const zhProps = zhSections.get(label) || [];
    const zhMap = new Map(zhProps.map((p) => [p.name, p]));
    const merged = enProps.map((enProp) => ({
      ...enProp,
      descriptionZh: zhMap.get(enProp.name)?.descriptionZh || zhMap.get(enProp.name)?.description || '',
    }));

    if (isMainSection(label, comp.name)) {
      props.push(...merged);
    } else {
      const fullName = label.includes('.') ? label : `${comp.name}.${label}`;
      subComponentProps[fullName] = [...(subComponentProps[fullName] || []), ...merged];
    }
  }

  return { props, subComponentProps };
}

/**
 * Backfill a component's empty fields from the major-version data.
 * Called only when doc-based backfill was insufficient.
 *
 * ⚠️ Mutates `comp` in place — the component object comes from metadataCache,
 * so this intentionally updates cached data. The mutation is idempotent
 * (only fills empty props/description/subComponentProps).
 *
 * Exported for testing. Not part of the public CLI API.
 */
export function backfillFromMajor(comp: ComponentData, majorStore: MetadataStore): void {
  const majorComp = findComponent(majorStore, comp.name);
  if (!majorComp) return;

  // 1. If still empty after doc parsing, fall back to major version props
  if (comp.props.length === 0 && majorComp.props.length > 0) {
    comp.props = [...majorComp.props];
    if (!comp.subComponentProps && majorComp.subComponentProps) {
      comp.subComponentProps = { ...majorComp.subComponentProps };
      for (const key of Object.keys(comp.subComponentProps)) {
        comp.subComponentProps[key] = [...majorComp.subComponentProps[key]];
      }
    }
  }

  // 2. Backfill descriptions independently (en may exist without zh)
  if (!comp.description && majorComp.description) {
    comp.description = majorComp.description;
  }
  if (!comp.descriptionZh && majorComp.descriptionZh) {
    comp.descriptionZh = majorComp.descriptionZh;
  }
}

/**
 * Load metadata for a version, find a component, and return both.
 * Returns CLIError with fuzzy-match suggestion if the component is not found.
 */
export function resolveComponent(
  component: string,
  version: string,
): { store: MetadataStore; comp: ComponentData } | CLIError {
  const store = loadMetadataForVersion(version);
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

  // Backfill empty fields from doc and/or major version data
  const majorVersion = `v${version.split('.')[0]}`;

  // 1. Try to backfill props from the component's own doc (no disk I/O)
  if (comp.props.length === 0 && comp.doc) {
    const parsed = parsePropsFromDoc(comp);
    if (parsed && parsed.props.length > 0) {
      comp.props = parsed.props;
      if (Object.keys(parsed.subComponentProps).length > 0 && !comp.subComponentProps) {
        comp.subComponentProps = parsed.subComponentProps;
      }
    }
  }

  // 2. Only load major store if props or localized descriptions are still missing
  const needsMajorBackfill = comp.props.length === 0 || !comp.description || !comp.descriptionZh;
  if (needsMajorBackfill) {
    const majorStore = loadMetadata(majorVersion);
    backfillFromMajor(comp, majorStore);
  }

  return { store, comp };
}
