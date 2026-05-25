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
import { parseTableRow, parseTable, parseApiSections, mergeProps } from './extractors/props.js';
import type { ComponentData, PropData, MetadataStore } from '../src/types.js';

const DATA_DIR = path.join(import.meta.dirname, '..', 'data');

/** Fix markdown escape remnants in a string value. */
export function cleanEscapes(value: string): string {
  return value
    .replace(/\\\[/g, '[')   // \[ → [
    .replace(/\\\]/g, ']')   // \] → ]
    .replace(/\\</g, '<')    // \< → <
    .replace(/\\>/g, '>');   // \> → >
}

/** Check if a prop has pipe-split corruption (type or default ends with trailing backslash). */
export function isPipeSplit(prop: PropData): boolean {
  return (prop.type || '').endsWith('\\') || (prop.default || '').endsWith('\\');
}

/**
 * Re-extract props from embedded doc markdown using the corrected parseTableRow.
 * Falls back to heuristic repair if doc is not available.
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

  if (prop.default && prop.default.endsWith('\\')) {
    // Multiple fragments: type, default, and possibly since are all type parts
    fragments.push(prop.default.replace(/\\$/, '').trim());
    if (prop.since && !/^\d+\.\d+(\.\d+)?$/.test(prop.since.trim())) {
      // since is a type fragment too
      fragments.push(prop.since.replace(/\\$/, '').trim());
      repaired.since = '';
    }
    repaired.default = '-';
  } else if (prop.default && (prop.default || '').trim() !== '-') {
    // Default is not "-" and type ends with \ — default is likely a type fragment
    fragments.push((prop.default || '').trim());
    if (prop.since && /^\d+\.\d+(\.\d+)?$/.test(prop.since.trim())) {
      // since is a version — default is lost
      repaired.default = '-';
    } else if (prop.since && /^-?$|^true|false$/i.test(prop.since.trim()) || /^\d+\.?\d*$/.test(prop.since.trim())) {
      // since looks like a default value
      repaired.default = prop.since;
      repaired.since = '';
    } else {
      // since is more type fragments
      if (prop.since) {
        fragments.push(prop.since.replace(/\\$/, '').trim());
      }
      repaired.default = '-';
      repaired.since = '';
    }
  } else {
    // Default is "-" — check if since is a type fragment
    if (prop.since && !/^\d+\.\d+(\.\d+)?$/.test(prop.since.trim())) {
      fragments.push(prop.since.replace(/\\$/, '').trim());
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

/** Fix all props in a component, returning counts of changes. */
function fixComponent(component: ComponentData): {
  escapeFixes: number;
  pipeFixes: number;
  docReparsed: number;
  heuristicRepairs: number;
} {
  let escapeFixes = 0;
  let pipeFixes = 0;
  let docReparsed = 0;
  let heuristicRepairs = 0;

  // Try to re-parse from doc for pipe-split corruption
  const reparsed = reparseFromDoc(component);

  function fixProps(props: PropData[]): void {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      let changed = false;

      // Fix pipe-split corruption using doc re-parse when available
      if (isPipeSplit(prop)) {
        if (reparsed && reparsed.has(prop.name)) {
          const correct = reparsed.get(prop.name)!;
          props[i] = {
            ...prop,
            type: correct.type,
            default: correct.default,
            since: correct.since || prop.since,
          };
          docReparsed++;
          changed = true;
        } else {
          // No doc re-parse available — fall back to heuristic repair
          // which may lose default/since info but at least produces valid type syntax
          props[i] = heuristicPipeSplitRepair(prop);
          heuristicRepairs++;
          changed = true;
        }
      }

      // Fix escape remnants in all string fields (always safe to apply)
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

      // Also fix since field
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
    for (const key of Object.keys(component.subComponentProps)) {
      fixProps(component.subComponentProps[key]);
    }
  }

  // Also fix escape remnants in sub-component props that have separate doc sections
  // by re-parsing their sections from the doc
  if (reparsed && component.subComponentProps) {
    for (const [subKey, subProps] of Object.entries(component.subComponentProps)) {
      // Sub-component props may use qualified names like "Button.Group"
      for (let i = 0; i < subProps.length; i++) {
        if (isPipeSplit(subProps[i])) {
          if (reparsed.has(subProps[i].name)) {
            const correct = reparsed.get(subProps[i].name)!;
            subProps[i] = {
              ...subProps[i],
              type: correct.type,
              default: correct.default,
              since: correct.since || subProps[i].since,
            };
            docReparsed++;
          }
        }
      }
    }
  }

  return { escapeFixes, pipeFixes, docReparsed, heuristicRepairs };
}

function main() {
  const shouldWrite = process.argv.includes('--write');

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^v\d+.*\.json$/.test(f))
    .sort();

  let totalEscapeFixes = 0;
  let totalPipeSplitRemaining = 0;
  let totalDocReparsed = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const store: MetadataStore = JSON.parse(raw);

    let fileEscapeFixes = 0;
    let filePipeSplitRemaining = 0;
    let fileDocReparsed = 0;

    // Count pipe-split props before fixing
    let pipeSplitBefore = 0;
    for (const component of store.components || []) {
      pipeSplitBefore += (component.props || []).filter(p => isPipeSplit(p)).length;
    }

    for (const component of store.components || []) {
      const counts = fixComponent(component);
      fileEscapeFixes += counts.escapeFixes;
      fileDocReparsed += counts.docReparsed;
    }

    // Count remaining pipe-split props after fixing
    for (const component of store.components || []) {
      filePipeSplitRemaining += (component.props || []).filter(p => isPipeSplit(p)).length;
      if (component.subComponentProps) {
        for (const subProps of Object.values(component.subComponentProps)) {
          filePipeSplitRemaining += (subProps as PropData[]).filter(p => isPipeSplit(p)).length;
        }
      }
    }

    const pipeFixed = pipeSplitBefore - filePipeSplitRemaining;

    if (fileEscapeFixes > 0 || pipeFixed > 0) {
      const newJson = JSON.stringify(store, null, 2) + '\n';

      if (shouldWrite) {
        fs.writeFileSync(filePath, newJson);
        console.log(`${file}: ${pipeFixed} pipe-split fixed (doc reparse), ${fileEscapeFixes} escape fixes, ${filePipeSplitRemaining} pipe-split remaining`);
      } else {
        console.log(`${file}: would fix ${pipeFixed} pipe-split (doc reparse), ${fileEscapeFixes} escape fixes, ${filePipeSplitRemaining} pipe-split remaining`);
      }

      totalEscapeFixes += fileEscapeFixes;
      totalPipeSplitRemaining += filePipeSplitRemaining;
      totalDocReparsed += fileDocReparsed;
    } else {
      console.log(`${file}: clean`);
    }
  }

  console.log(`\nTotal: ${totalDocReparsed} pipe-split fixed via doc reparse, ${totalEscapeFixes} escape fixes, ${totalPipeSplitRemaining} pipe-split remaining (need re-extraction from antd source)`);
  if (!shouldWrite) {
    console.log('Run with --write to apply changes');
  }
}

main();