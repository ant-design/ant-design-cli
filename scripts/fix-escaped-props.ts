#!/usr/bin/env node

/**
 * Fix corrupted prop metadata in data/*.json files.
 *
 * Two types of corruption:
 * 1. Markdown escape remnants: \[ → [, \] → ], \< → <, \> → >
 *    These appear in type, default, and description fields across all files.
 *
 * 2. Pipe-split corruption: when a type value contained `|` (union types),
 *    the old parser treated `\|` as a column delimiter, splitting the value
 *    across type/default/since fields. The remnant trailing `\` in type/default
 *    indicates this corruption.
 *
 * Usage:
 *   npx tsx scripts/fix-escaped-props.ts          # dry run (print changes)
 *   npx tsx scripts/fix-escaped-props.ts --write   # write fixes to files
 */

import fs from 'node:fs';
import path from 'node:path';
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

/** Check if a value looks like a semver version string. */
export function isVersion(value: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(value.trim());
}

/**
 * Check if a value looks like a typical prop default value.
 * Includes backtick-wrapped strings, identifiers, and literals common in antd defaults.
 * Handles both raw and escape-cleaned forms (e.g., both \[] and []).
 */
export function isSimpleDefault(value: string): boolean {
  if (!value) return true;
  const v = value.trim();
  return /^-?$/.test(v)                     // "-" or empty
    || /^true|false$/i.test(v)              // boolean literal
    || /^\d+\.?\d*$/.test(v)                // number
    || /^\\?\[\\?\]$/.test(v)               // empty array: [] or \[]
    || /^0x[\da-f]+$/i.test(v)              // hex
    || /^`.+`$/.test(v)                     // backtick-wrapped: `small`, `default`
    || /^"[^"]*"$/.test(v)                  // double-quoted string
    || /^'[^']*'$/.test(v)                  // single-quoted string
    || /^[a-zA-Z][\w.-]*$/.test(v);         // plain identifier: div, form, span, React.Fragment
}

/**
 * Check if a value is unambiguously a default value (not a type value).
 * Used for Pattern A (multi-fragment pipe-split) where since could be
 * either a type fragment or a shifted default. Only values that are
 * definitively defaults (dash, boolean, number, empty array) qualify.
 * Plain identifiers like "end", "div" are NOT strict defaults because
 * they could be enum members in a union type.
 */
export function isStrictDefault(value: string): boolean {
  if (!value) return true;
  const v = value.trim();
  return /^-$/.test(v)                      // dash (antd convention for "no default")
    || /^true|false$/i.test(v)              // boolean literal
    || /^\d+\.?\d*$/.test(v)                // number
    || /^\\?\[\\?\]$/.test(v)               // empty array: [] or \[]
    || /^0x[\da-f]+$/i.test(v);             // hex
}
export function looksLikeType(value: string): boolean {
  return /[(){}<>\[\]|]/.test(value)         // contains type syntax chars
    || /=>/.test(value)                       // arrow function
    || value.length > 60;                     // very long → likely a type
}

/** Check if a prop has pipe-split corruption (type or default ends with trailing backslash). */
export function isPipeSplit(prop: PropData): boolean {
  return (prop.type || '').endsWith('\\') || (prop.default || '').endsWith('\\');
}

/**
 * Attempt to repair pipe-split corruption in a prop.
 *
 * When the old parser split on `|` inside a union type, the markdown table cells
 * got misaligned. Example patterns:
 *
 * Pattern A (multi-fragment): type ends with \, default ends with \
 *   type="start \"    default="center \"    since="end"
 *   → type was "start | center | end", default/since lost
 *
 * Pattern B (last fragment): type ends with \, default is last fragment
 *   type="boolean \"    default="{ goButton: ReactNode }"    since="false"
 *   → type was "boolean | { goButton: ReactNode }", default="false", since lost
 *
 * Pattern C (shifted default): type ends with \, since holds the actual default
 *   type="`left` \"    default="-"    since="`right`"
 *   → type was "`left` | `right`", default="-", since lost
 */
export function repairPipeSplit(prop: PropData): PropData {
  const repaired = { ...prop };
  const fragments: string[] = [];

  // Type always ends with \ in pipe-split cases — first fragment
  if (prop.type) {
    fragments.push(prop.type.replace(/\\$/, '').trim());
  }

  if (prop.default && prop.default.endsWith('\\')) {
    // Pattern A: default ends with \ — multiple type fragments were split.
    // since is most likely also a type fragment (the split pushed things right),
    // UNLESS it's unmistakably a default value like "-" or a number.
    fragments.push(prop.default.replace(/\\$/, '').trim());

    if (prop.since && isVersion(prop.since)) {
      // since is a real version — keep it, default is lost
    } else if (prop.since && isStrictDefault(prop.since)) {
      // since is unambiguously a default value (dash, boolean, number, empty array)
      repaired.default = prop.since;
      repaired.since = '';
    } else if (prop.since) {
      // since is likely a type fragment — add to fragments (strip trailing \)
      fragments.push(prop.since.replace(/\\$/, '').trim());
      repaired.since = '';
    }
    repaired.default = prop.since && isStrictDefault(prop.since) ? prop.since : '-';
  } else {
    // Type ends with \ but default doesn't end with \
    // Default is always shifted (it's either a type fragment or a shifted value)
    const isDash = (prop.default || '').trim() === '-';

    if (isDash) {
      // Default is "-" — it could be the actual default or shifted.
      // If since is a type fragment (not a version, not a simple default), use it.
      if (prop.since && !isVersion(prop.since) && looksLikeType(prop.since)) {
        fragments.push(prop.since.replace(/\\$/, '').trim());
        repaired.since = '';
      } else if (prop.since && !isVersion(prop.since) && isSimpleDefault(prop.since)) {
        // since looks like a default, but type still has a trailing \
        // The "-" in default is the actual default; since might be a type fragment
        // or another shifted default. Use since as a type fragment if type is incomplete.
        fragments.push(prop.since.replace(/\\$/, '').trim());
        repaired.since = '';
      }
      // Keep default as "-"
    } else {
      // Default is NOT "-" — it's a type fragment (the pipe split shifted columns)
      fragments.push((prop.default || '').trim());

      // since might hold the actual default value
      if (prop.since && isVersion(prop.since)) {
        // since is a real version — the actual default is lost
        repaired.default = '-';
      } else if (prop.since && isSimpleDefault(prop.since) && !looksLikeType(prop.since)) {
        // since looks like a default value (e.g., "div", "false", "`top`", "-")
        repaired.default = prop.since;
        repaired.since = '';
      } else if (prop.since) {
        // since is a complex expression — likely a type fragment
        if (prop.since.endsWith('\\')) {
          fragments.push(prop.since.replace(/\\$/, '').trim());
        } else {
          fragments.push(prop.since.trim());
        }
        repaired.default = '-';
        repaired.since = '';
      } else {
        // since is empty — default is lost
        repaired.default = '-';
      }
    }
  }

  if (fragments.length > 1) {
    repaired.type = fragments.join(' | ');
  } else if (fragments.length === 1) {
    repaired.type = fragments[0];
  }

  return repaired;
}

/** Fix all props in a component, returning count of changes. */
function fixProps(props: PropData[]): { escapeFixes: number; pipeFixes: number } {
  let escapeFixes = 0;
  let pipeFixes = 0;

  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    let changed = false;

    // Fix pipe-split corruption first (before escape cleanup, since values end with \)
    if (isPipeSplit(prop)) {
      props[i] = repairPipeSplit(prop);
      pipeFixes++;
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

    // Also fix since field
    if (typeof props[i].since === 'string' && props[i].since!.includes('\\')) {
      props[i].since = cleanEscapes(props[i].since!);
      if (!changed) escapeFixes++;
    }
  }

  return { escapeFixes, pipeFixes };
}

/** Fix all sub-component props too. */
function fixComponent(component: ComponentData): { escapeFixes: number; pipeFixes: number } {
  let escapeFixes = 0;
  let pipeFixes = 0;

  if (component.props) {
    const counts = fixProps(component.props);
    escapeFixes += counts.escapeFixes;
    pipeFixes += counts.pipeFixes;
  }

  if (component.subComponentProps) {
    for (const key of Object.keys(component.subComponentProps)) {
      const counts = fixProps(component.subComponentProps[key]);
      escapeFixes += counts.escapeFixes;
      pipeFixes += counts.pipeFixes;
    }
  }

  return { escapeFixes, pipeFixes };
}

function main() {
  const shouldWrite = process.argv.includes('--write');

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^v\d+.*\.json$/.test(f))
    .sort();

  let totalEscapeFixes = 0;
  let totalPipeFixes = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const store: MetadataStore = JSON.parse(raw);

    let fileEscapeFixes = 0;
    let filePipeFixes = 0;

    for (const component of store.components || []) {
      const counts = fixComponent(component);
      fileEscapeFixes += counts.escapeFixes;
      filePipeFixes += counts.pipeFixes;
    }

    if (fileEscapeFixes > 0 || filePipeFixes > 0) {
      const newJson = JSON.stringify(store, null, 2) + '\n';

      if (shouldWrite) {
        fs.writeFileSync(filePath, newJson);
        console.log(`${file}: fixed ${filePipeFixes} pipe-split + ${fileEscapeFixes} escape remnants (written)`);
      } else {
        console.log(`${file}: would fix ${filePipeFixes} pipe-split + ${fileEscapeFixes} escape remnants (dry run)`);
      }

      totalEscapeFixes += fileEscapeFixes;
      totalPipeFixes += filePipeFixes;
    } else {
      console.log(`${file}: clean`);
    }
  }

  console.log(`\nTotal: ${totalPipeFixes} pipe-split fixes, ${totalEscapeFixes} escape remnant fixes`);
  if (!shouldWrite) {
    console.log('Run with --write to apply changes');
  }
}

main();