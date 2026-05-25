#!/usr/bin/env node

/**
 * Fix corrupted prop metadata in data/*.json files.
 *
 * Two types of corruption:
 * 1. Markdown escape remnants: \[ → [, \] → ], \< → <, \> → >
 *    These appear in type, default, and description fields across all files.
 *
 * 2. Pipe-split corruption: when a type value contained `\|` (union types),
 *    the old parser treated it as a column delimiter, splitting the value
 *    across type/default/since fields. This is repaired by re-parsing the
 *    embedded `doc`/`docZh` markdown with the corrected `parseTableRow`.
 *
 * Usage:
 *   npx tsx scripts/fix-escaped-props.ts          # dry run (print changes)
 *   npx tsx scripts/fix-escaped-props.ts --write   # write fixes to files
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseApiSections, mergeProps } from './extractors/props.js';
import type { ComponentData, PropData, MetadataStore } from '../src/types.js';

const DATA_DIR = path.join(import.meta.dirname, '..', 'data');

const VERSION_RE = /^v?\d+\.\d+(\.\d+)?(-[\w.]+)?$/;

/** Fix markdown escape remnants in a string value. */
export function cleanEscapes(value: string): string {
  return value.replace(/\\([\[\]<>])/g, '$1');
}

/** Check if a prop has pipe-split corruption (type or default ends with trailing backslash). */
export function isPipeSplit(prop: PropData): boolean {
  return (prop.type || '').endsWith('\\') || (prop.default || '').endsWith('\\');
}

/**
 * Re-extract props from embedded doc markdown using the corrected parseTableRow.
 * Returns a Map keyed by both bare prop name and qualified name (e.g. "Tabs.TabPane.tab").
 */
function reparseFromDoc(component: ComponentData): Map<string, PropData> | null {
  if (!component.doc) return null;

  const enSections = parseApiSections(component.doc, 'en');
  let zhSections = new Map<string, PropData[]>();
  if (component.docZh) {
    zhSections = parseApiSections(component.docZh, 'zh');
  }

  const reparsed = new Map<string, PropData>();

  for (const [label, enProps] of enSections) {
    const zhProps = zhSections.get(label) || [];
    const merged = mergeProps(enProps, zhProps);
    for (const prop of merged) {
      reparsed.set(prop.name, prop);
      // Also store under qualified name for sub-component lookup
      if (label !== '__api_root__' && label !== '__main__') {
        reparsed.set(`${component.name}.${label}.${prop.name}`, prop);
      }
    }
  }

  return reparsed;
}

/**
 * Heuristic repair for pipe-split corruption when doc re-parse is unavailable.
 *
 * WARNING: This is lossy — default values and since version info may be
 * incorrect or lost. It reconstructs the type union by joining fragments
 * but cannot reliably determine where the type ends and the default begins.
 */
function heuristicPipeSplitRepair(prop: PropData): PropData {
  const repaired = { ...prop };
  const fragments: string[] = [];

  if (prop.type) {
    fragments.push(prop.type.replace(/\\$/, '').trim());
  }

  const since = prop.since?.trim() || '';
  const isSinceVersion = VERSION_RE.test(since);

  if (prop.default && prop.default.endsWith('\\')) {
    // Multiple fragments: type, default, and possibly since are all type parts
    fragments.push(prop.default.replace(/\\$/, '').trim());
    if (since && !isSinceVersion) {
      fragments.push(since.replace(/\\$/, '').trim());
      repaired.since = '';
    }
    repaired.default = '-';
  } else if (prop.default && prop.default.trim() !== '-') {
    // Default is not "-" and type ends with \ — default is likely a type fragment
    fragments.push(prop.default.trim());
    if (!since) {
      repaired.default = '-';
    } else if (isSinceVersion) {
      repaired.default = '-';
    } else if (/^-?$/.test(since) || /^(true|false)$/i.test(since) || /^-?\d*\.?\d+$/.test(since)) {
      repaired.default = prop.since;
      repaired.since = '';
    } else {
      fragments.push(since.replace(/\\$/, '').trim());
      repaired.default = '-';
      repaired.since = '';
    }
  } else {
    // Default is "-" — check if since is a type fragment
    if (since && !isSinceVersion) {
      fragments.push(since.replace(/\\$/, '').trim());
      repaired.since = '';
    }
  }

  if (fragments.length > 1) {
    repaired.type = fragments.join(' | ');
  } else if (fragments.length === 1) {
    repaired.type = fragments[0];
  }

  return repaired;
}

/** Count pipe-split props across both main and sub-component props. */
function countPipeSplit(component: ComponentData): number {
  let count = (component.props || []).filter(p => isPipeSplit(p)).length;
  if (component.subComponentProps) {
    for (const subProps of Object.values(component.subComponentProps)) {
      count += (subProps as PropData[]).filter(p => isPipeSplit(p)).length;
    }
  }
  return count;
}

/** Fix all props in a component, returning counts of changes. */
function fixComponent(component: ComponentData): {
  escapeFixes: number;
  docReparsed: number;
  heuristicRepairs: number;
} {
  let escapeFixes = 0;
  let docReparsed = 0;
  let heuristicRepairs = 0;

  const reparsed = reparseFromDoc(component);

  function fixProps(props: PropData[], qualifiedPrefix?: string): void {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      let changed = false;

      if (isPipeSplit(prop)) {
        // Try qualified name first for sub-component props, then bare name
        const lookupKey = qualifiedPrefix ? `${qualifiedPrefix}.${prop.name}` : prop.name;
        const correct = reparsed?.get(lookupKey) || reparsed?.get(prop.name);
        if (correct) {
          props[i] = {
            ...prop,
            type: correct.type,
            default: correct.default,
            since: correct.since || prop.since,
          };
          docReparsed++;
        } else {
          props[i] = heuristicPipeSplitRepair(prop);
          heuristicRepairs++;
        }
        changed = true;
      }

      // Fix escape remnants in all string fields
      for (const field of ['type', 'default', 'description', 'descriptionZh'] as const) {
        const val = props[i][field];
        if (typeof val === 'string' && val.includes('\\')) {
          const cleaned = cleanEscapes(val);
          if (cleaned !== val) {
            (props[i] as Record<string, string>)[field] = cleaned;
            if (!changed) escapeFixes++;
            changed = true;
          }
        }
      }

      if (typeof props[i].since === 'string' && props[i].since!.includes('\\')) {
        props[i].since = cleanEscapes(props[i].since!);
        if (!changed) escapeFixes++;
      }
    }
  }

  if (component.props) {
    fixProps(component.props);
  }

  if (component.subComponentProps) {
    for (const [key, subProps] of Object.entries(component.subComponentProps)) {
      fixProps(subProps, `${component.name}.${key}`);
    }
  }

  return { escapeFixes, docReparsed, heuristicRepairs };
}

function main() {
  const shouldWrite = process.argv.includes('--write');

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^v\d+.*\.json$/.test(f))
    .sort();

  let totalEscapeFixes = 0;
  let totalPipeSplitRemaining = 0;
  let totalDocReparsed = 0;
  let totalHeuristicRepairs = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const store: MetadataStore = JSON.parse(raw);

    let fileEscapeFixes = 0;
    let filePipeSplitBefore = 0;
    let filePipeSplitAfter = 0;
    let fileDocReparsed = 0;
    let fileHeuristicRepairs = 0;

    for (const component of store.components || []) {
      filePipeSplitBefore += countPipeSplit(component);
      const counts = fixComponent(component);
      fileEscapeFixes += counts.escapeFixes;
      fileDocReparsed += counts.docReparsed;
      fileHeuristicRepairs += counts.heuristicRepairs;
    }

    // Count remaining pipe-split props after fixing
    for (const component of store.components || []) {
      filePipeSplitAfter += countPipeSplit(component);
    }

    const pipeFixed = filePipeSplitBefore - filePipeSplitAfter;

    if (fileEscapeFixes > 0 || pipeFixed > 0) {
      const newJson = JSON.stringify(store, null, 2) + '\n';

      if (shouldWrite) {
        fs.writeFileSync(filePath, newJson);
        console.log(`${file}: ${pipeFixed} pipe-split fixed (${fileDocReparsed} doc, ${fileHeuristicRepairs} heuristic), ${fileEscapeFixes} escape fixes, ${filePipeSplitAfter} remaining`);
      } else {
        console.log(`${file}: would fix ${pipeFixed} pipe-split (${fileDocReparsed} doc, ${fileHeuristicRepairs} heuristic), ${fileEscapeFixes} escape fixes, ${filePipeSplitAfter} remaining`);
      }

      totalEscapeFixes += fileEscapeFixes;
      totalPipeSplitRemaining += filePipeSplitAfter;
      totalDocReparsed += fileDocReparsed;
      totalHeuristicRepairs += fileHeuristicRepairs;
    } else {
      console.log(`${file}: clean`);
    }
  }

  console.log(`\nTotal: ${totalDocReparsed} doc-reparse + ${totalHeuristicRepairs} heuristic = ${totalDocReparsed + totalHeuristicRepairs} pipe-split fixes, ${totalEscapeFixes} escape fixes, ${totalPipeSplitRemaining} remaining`);
  if (!shouldWrite) {
    console.log('Run with --write to apply changes');
  }
}

main();