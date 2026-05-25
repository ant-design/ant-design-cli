#!/usr/bin/env node

/**
 * Fix corrupted prop metadata in data/*.json files.
 *
 * Three types of corruption:
 * 1. Markdown escape remnants: \[ → [, \] → ], \< → <, \> → >
 *    These appear in type, default, and description fields across all files.
 *
 * 2. Pipe-split corruption: when a type value contained `\|` (union types),
 *    the old parser treated it as a column delimiter, splitting the value
 *    across type/default/since fields. This is repaired by re-parsing the
 *    embedded `doc`/`docZh` markdown with the corrected `parseTableRow`.
 *
 * 3. HTML entity remnants: &lt; → <, &gt; → >, &amp; → &
 *    Older antd docs used HTML entities for angle brackets in type annotations.
 *
 * Usage:
 *   npx tsx scripts/fix-escaped-props.ts          # dry run (print changes)
 *   npx tsx scripts/fix-escaped-props.ts --write   # write fixes to files
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseApiSections, mergeProps } from './extractors/props.js';
import type { ComponentData, PropData, MetadataStore } from '../src/types.js';

const DATA_DIR = path.join(import.meta.dirname, '..', 'data');

const VERSION_RE = /^v?\d+\.\d+(\.\d+)?(-[\w.]+)?$/;

/** Fix markdown escape remnants and HTML entities in a string value. */
export function cleanEscapes(value: string): string {
  return value
    .replace(/\\([\[\]<>])/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Check if a prop has pipe-split corruption (type or default ends with trailing backslash). */
export function isPipeSplit(prop: PropData): boolean {
  return (prop.type || '').endsWith('\\') || (prop.default || '').endsWith('\\');
}

/**
 * Check if a prop has unescaped-pipe column misalignment.
 * This occurs when the source markdown has bare `|` in a union type that was not
 * escaped with `\|`, causing the parser to split columns incorrectly.
 * Heuristic: default contains type-like syntax with a `|` (union) but type is
 * incomplete — either too short, or default is clearly a type expression
 * rather than a value expression.
 */
export function isColumnMisaligned(prop: PropData): boolean {
  if (isPipeSplit(prop)) return false;
  const def = (prop.default || '').trim();
  const type = (prop.type || '').trim();
  if (!def || def === '-') return false;
  // Default must contain a pipe (union type indicator) or be clearly a type fragment
  // Exclude markdown links, backtick-only values, and legitimate JSX/function defaults
  if (!/[|]/.test(def)) return false;
  // Exclude markdown links like [default](url)
  if (/^\[.*\]\(.*\)$/.test(def)) return false;
  // Exclude backtick-only values
  if (/^`.+`$/.test(def)) return false;
  // Default contains a `|` (union) — very likely a type fragment that belongs in type
  return true;
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
 * Handles two patterns:
 * 1. Standard: type/default end with trailing \
 * 2. Backtick-union: type ends with \, default and since are backtick-wrapped values
 *    (e.g. type="`top` | `right` | `bottom` \", default="`left`", since="`top`")
 *    This means: default and since were shifted right by the pipe split.
 *    Fix: type = type + " | " + default, default = since, since = ""
 */
function heuristicPipeSplitRepair(prop: PropData): PropData {
  const repaired = { ...prop };

  // Pattern: type ends with \, default is backtick-wrapped, since is backtick-wrapped
  // This is the "backtick-union" pipe-split: the last union member became the default,
  // and the original default shifted into since.
  if ((prop.type || '').endsWith('\\') && /^`.+`$/.test(prop.default || '') && /^`.+`$/.test(prop.since || '')) {
    repaired.type = prop.type!.replace(/\\\s*$/, '') + ' | ' + prop.default;
    repaired.default = prop.since!;
    repaired.since = '';
    return repaired;
  }

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

/**
 * Repair unescaped-pipe column misalignment using doc reparse.
 * This handles cases where the source markdown had bare `|` in a union type
 * (not escaped as `\|`), causing the parser to split columns incorrectly.
 * Unlike pipe-split (trailing `\`), these don't have a trailing backslash
 * but the default field contains type-like content that should be in type.
 */
function fixColumnMisaligned(prop: PropData, reparsed: Map<string, PropData> | null, qualifiedPrefix?: string): boolean {
  if (!reparsed) return false;
  const lookupKey = qualifiedPrefix ? `${qualifiedPrefix}.${prop.name}` : prop.name;
  const correct = reparsed.get(lookupKey) || reparsed.get(prop.name);
  if (!correct) return false;

  // Only fix if the reparsed version's default differs and the current default
  // looks like it contains type syntax
  if (correct.default !== prop.default && isColumnMisaligned(prop)) {
    prop.type = correct.type;
    prop.default = correct.default;
    if (correct.since) prop.since = correct.since;
    return true;
  }
  return false;
}

/**
 * Clean up since field anomalies:
 * - Extract version from patterns like "object: 5.19.0" → "5.19.0"
 * - Replace "×" (multiplication sign) with empty string
 * - Remove backtick-wrapped content that's not a version
 */
function cleanSinceField(prop: PropData): boolean {
  if (typeof prop.since !== 'string' || !prop.since) return false;
  const original = prop.since;

  // Pattern: "type: version" like "object: 5.19.0" or "function(): 4.4.0"
  const typeVersionMatch = prop.since.match(/^(?:[\w()<>\[\]|, ]+)\s*:\s*(v?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)$/);
  if (typeVersionMatch) {
    prop.since = typeVersionMatch[1];
  }

  // Pattern: "×" (multiplication sign used as separator or placeholder)
  if (prop.since === '×' || prop.since === '✖' || prop.since === '') {
    delete (prop as Record<string, unknown>).since;
  }

  return prop.since !== original;
}

/** Fix all props in a component, returning counts of changes. */
function fixComponent(component: ComponentData): {
  escapeFixes: number;
  docReparsed: number;
  heuristicRepairs: number;
  misalignedFixes: number;
  sinceFixes: number;
} {
  let escapeFixes = 0;
  let docReparsed = 0;
  let heuristicRepairs = 0;
  let misalignedFixes = 0;
  let sinceFixes = 0;

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
            since: correct.since !== undefined
                ? correct.since || undefined
                : (VERSION_RE.test(prop.since?.trim() ?? '') ? prop.since : undefined),
          };
          docReparsed++;
        } else {
          props[i] = heuristicPipeSplitRepair(prop);
          heuristicRepairs++;
        }
        changed = true;
      } else if (isColumnMisaligned(prop)) {
        // Try to fix via doc reparse for unescaped-pipe misalignment
        if (fixColumnMisaligned(props[i], reparsed, qualifiedPrefix)) {
          misalignedFixes++;
          changed = true;
        }
      }

      // Fix since field anomalies
      if (cleanSinceField(props[i])) {
        if (!changed) sinceFixes++;
        changed = true;
      }

      // Fix escape remnants and HTML entities in all string fields
      for (const field of ['type', 'default', 'description', 'descriptionZh'] as const) {
        const val = props[i][field];
        if (typeof val === 'string' && (val.includes('\\') || val.includes('&lt;') || val.includes('&gt;') || val.includes('&amp;'))) {
          const cleaned = cleanEscapes(val);
          if (cleaned !== val) {
            (props[i] as Record<string, string>)[field] = cleaned;
            if (!changed) escapeFixes++;
            changed = true;
          }
        }
      }

      if (typeof props[i].since === 'string' && (props[i].since!.includes('\\') || props[i].since!.includes('&lt;') || props[i].since!.includes('&gt;') || props[i].since!.includes('&amp;'))) {
        props[i].since = cleanEscapes(props[i].since!);
        if (!changed) escapeFixes++;
      }

      // Second-pass pipe-split check: after doc reparse + escape cleanup,
      // some props still have type ending with \ (doc itself had the bug).
      // Pattern: type ends with \, default is backtick-wrapped, since is backtick-wrapped.
      if (isPipeSplit(props[i]) && /^`.+`$/.test(props[i].default || '') && /^`.+`$/.test(props[i].since || '')) {
        props[i] = {
          ...props[i],
          type: props[i].type!.replace(/\\\s*$/, '').replace(/\s+$/, '') + ' | ' + props[i].default,
          default: props[i].since!,
          since: '',
        };
        if (!changed) heuristicRepairs++;
        changed = true;
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

  return { escapeFixes, docReparsed, heuristicRepairs, misalignedFixes, sinceFixes };
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
  let totalMisalignedFixes = 0;
  let totalSinceFixes = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const store: MetadataStore = JSON.parse(raw);

    let fileEscapeFixes = 0;
    let filePipeSplitBefore = 0;
    let filePipeSplitAfter = 0;
    let fileDocReparsed = 0;
    let fileHeuristicRepairs = 0;
    let fileMisalignedFixes = 0;
    let fileSinceFixes = 0;

    for (const component of store.components || []) {
      filePipeSplitBefore += countPipeSplit(component);
      const counts = fixComponent(component);
      fileEscapeFixes += counts.escapeFixes;
      fileDocReparsed += counts.docReparsed;
      fileHeuristicRepairs += counts.heuristicRepairs;
      fileMisalignedFixes += counts.misalignedFixes;
      fileSinceFixes += counts.sinceFixes;
    }

    // Count remaining pipe-split props after fixing
    for (const component of store.components || []) {
      filePipeSplitAfter += countPipeSplit(component);
    }

    const pipeFixed = filePipeSplitBefore - filePipeSplitAfter;
    const hasFixes = fileEscapeFixes > 0 || pipeFixed > 0 || fileMisalignedFixes > 0 || fileSinceFixes > 0;

    totalPipeSplitRemaining += filePipeSplitAfter;

    if (hasFixes) {
      const newJson = JSON.stringify(store, null, 2) + '\n';

      if (shouldWrite) {
        fs.writeFileSync(filePath, newJson);
        console.log(`${file}: ${pipeFixed} pipe-split (${fileDocReparsed} doc, ${fileHeuristicRepairs} heuristic), ${fileMisalignedFixes} misaligned, ${fileSinceFixes} since, ${fileEscapeFixes} escape, ${filePipeSplitAfter} remaining`);
      } else {
        console.log(`${file}: would fix ${pipeFixed} pipe-split (${fileDocReparsed} doc, ${fileHeuristicRepairs} heuristic), ${fileMisalignedFixes} misaligned, ${fileSinceFixes} since, ${fileEscapeFixes} escape, ${filePipeSplitAfter} remaining`);
      }

      totalEscapeFixes += fileEscapeFixes;
      totalDocReparsed += fileDocReparsed;
      totalHeuristicRepairs += fileHeuristicRepairs;
      totalMisalignedFixes += fileMisalignedFixes;
      totalSinceFixes += fileSinceFixes;
    } else if (filePipeSplitAfter > 0) {
      console.log(`${file}: ${filePipeSplitAfter} pipe-split remaining`);
    } else {
      console.log(`${file}: clean`);
    }
  }

  console.log(`\nTotal: ${totalDocReparsed} doc + ${totalHeuristicRepairs} heuristic = ${totalDocReparsed + totalHeuristicRepairs} pipe-split, ${totalMisalignedFixes} misaligned, ${totalSinceFixes} since, ${totalEscapeFixes} escape, ${totalPipeSplitRemaining} remaining`);
  if (!shouldWrite) {
    console.log('Run with --write to apply changes');
  }
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main();
}