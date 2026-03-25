import type { Command } from 'commander';
import type { GlobalOptions, ComponentData, PropData, ChangelogEntry, CLIError } from '../types.js';
import { loadMetadataForVersion, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion, compare } from '../data/version.js';
import { output } from '../output/formatter.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';

// ── Changelog logic ──

function parseVersionRange(version: string): { from: string; to: string } | { exact: string } {
  if (version.includes('..')) {
    const [from, to] = version.split('..');
    return { from, to };
  }
  return { exact: version };
}

function filterEntries(changelog: ChangelogEntry[], versionArg?: string): ChangelogEntry[] {
  if (!versionArg) return changelog.slice(0, 5);

  const parsed = parseVersionRange(versionArg);
  if ('exact' in parsed) {
    return changelog.filter((e) => e.version === parsed.exact);
  }
  return changelog.filter(
    (e) => compare(e.version, parsed.from) >= 0 && compare(e.version, parsed.to) <= 0,
  );
}

const EMOJI_MAP: Record<string, string> = {
  feature: '🆕',
  fix: '🐞',
  style: '💄',
  deprecation: '🗑',
  breaking: '🔥',
  other: '🛠',
};

// ── API diff logic ──

export interface PropDiff {
  name: string;
  type?: string;
  replacement?: string;
  change?: string;
}

export interface ComponentDiff {
  component: string;
  added: PropDiff[];
  removed: PropDiff[];
  changed: PropDiff[];
}

export interface ChangelogResult {
  entries: ChangelogEntry[];
  versionArg?: string;
}

export interface DiffResult {
  from: string;
  to: string;
  diffs: ComponentDiff[];
  component?: string;
}

function diffProps(
  oldProps: PropData[],
  newProps: PropData[],
): { added: PropDiff[]; removed: PropDiff[]; changed: PropDiff[] } {
  const oldMap = new Map(oldProps.map((p) => [p.name, p]));
  const newMap = new Map(newProps.map((p) => [p.name, p]));

  const added: PropDiff[] = [];
  const removed: PropDiff[] = [];
  const changed: PropDiff[] = [];

  for (const [name, prop] of newMap) {
    if (!oldMap.has(name)) {
      added.push({ name, type: prop.type });
    } else {
      const oldProp = oldMap.get(name)!;
      if (oldProp.type !== prop.type) {
        changed.push({ name, change: `${oldProp.type} → ${prop.type}` });
      }
    }
  }

  for (const [name, prop] of oldMap) {
    if (!newMap.has(name)) {
      const possibleRename = [...newMap.values()].find(
        (p) => p.type === prop.type && !oldMap.has(p.name),
      );
      removed.push({ name, type: prop.type, replacement: possibleRename?.name });
    }
  }

  return { added, removed, changed };
}

/**
 * Core function: query changelog entries.
 * Returns changelog data or CLIError. Never writes to stdout.
 */
export function queryChangelog(opts: {
  snapshotVersion: string;
  entryFilter?: string;
}): ChangelogResult | CLIError {
  const store = loadMetadataForVersion(opts.snapshotVersion);
  const changelog = store.changelog || [];

  if (changelog.length === 0) {
    return createError(
      ErrorCodes.VERSION_NOT_FOUND,
      'No changelog data available',
    );
  }

  const entries = filterEntries(changelog, opts.entryFilter);
  if (entries.length === 0) {
    return createError(
      ErrorCodes.VERSION_NOT_FOUND,
      `No changelog entries found for "${opts.entryFilter}"`,
      `Available versions: ${changelog.map((e) => e.version).join(', ')}`,
    );
  }

  return { entries, versionArg: opts.entryFilter };
}

/**
 * Core function: diff API between two versions.
 * Returns diff data or CLIError. Never writes to stdout.
 */
export function diffChangelog(opts: {
  v1: string;
  v2: string;
  component?: string;
}): DiffResult | CLIError {
  // Validate version order
  if (compare(opts.v1, opts.v2) > 0) {
    return createError(
      ErrorCodes.INVALID_ARGUMENT,
      `Version order is invalid: "${opts.v1}" is newer than "${opts.v2}"`,
      `Swap the versions: v1=${opts.v2}, v2=${opts.v1}`,
    );
  }

  const store1 = loadMetadataForVersion(opts.v1);
  const store2 = loadMetadataForVersion(opts.v2);

  if (store1.components.length === 0) {
    return createError(ErrorCodes.VERSION_NOT_FOUND, `No data available for version ${opts.v1}`);
  }
  if (store2.components.length === 0) {
    return createError(ErrorCodes.VERSION_NOT_FOUND, `No data available for version ${opts.v2}`);
  }

  const componentsToCompare: string[] = opts.component
    ? [opts.component]
    : [...new Set([...getAllComponentNames(store1), ...getAllComponentNames(store2)])];

  if (opts.component) {
    const c1 = findComponent(store1, opts.component);
    const c2 = findComponent(store2, opts.component);
    if (!c1 && !c2) {
      const allNames = [...new Set([...getAllComponentNames(store1), ...getAllComponentNames(store2)])];
      const suggestion = fuzzyMatch(opts.component, allNames);
      return createError(
        ErrorCodes.COMPONENT_NOT_FOUND,
        `Component '${opts.component}' not found in either version`,
        suggestion ? `Did you mean '${suggestion}'?` : undefined,
      );
    }
  }

  const diffs: ComponentDiff[] = [];
  for (const name of componentsToCompare) {
    const c1 = findComponent(store1, name);
    const c2 = findComponent(store2, name);

    if (!c1 && c2) {
      diffs.push({ component: name, added: c2.props.map((p) => ({ name: p.name, type: p.type })), removed: [], changed: [] });
    } else if (c1 && !c2) {
      diffs.push({ component: name, added: [], removed: c1.props.map((p) => ({ name: p.name, type: p.type })), changed: [] });
    } else if (c1 && c2) {
      const { added, removed, changed } = diffProps(c1.props, c2.props);
      if (added.length > 0 || removed.length > 0 || changed.length > 0) {
        diffs.push({ component: name, added, removed, changed });
      }
    }
  }

  return { from: opts.v1, to: opts.v2, diffs, component: opts.component };
}

// ── Printing helpers (CLI only) ──

function printChangelogEntries(entries: ChangelogEntry[], format: string, versionArg?: string): void {
  if (format === 'json') {
    output(versionArg ? entries : { latest: entries }, 'json');
    return;
  }
  for (const entry of entries) {
    console.log(`## ${entry.version} (${entry.date})`);
    console.log('');
    for (const change of entry.changes) {
      const emoji = EMOJI_MAP[change.type] || '•';
      console.log(`  ${emoji} ${change.component} ${change.description}`);
    }
    console.log('');
  }
}

function printApiDiff(result: DiffResult, format: string): void {
  if (format === 'json') {
    const jsonResult = result.component && result.diffs.length > 0
      ? { from: result.from, to: result.to, ...result.diffs[0] }
      : { from: result.from, to: result.to, diffs: result.diffs };
    output(jsonResult, 'json');
    return;
  }

  if (result.diffs.length === 0) {
    console.log(`No API differences found between ${result.from} and ${result.to}.`);
    return;
  }

  console.log(`API Diff: ${result.from} → ${result.to}`);
  console.log('');
  for (const diff of result.diffs) {
    console.log(`  ${diff.component}:`);
    for (const p of diff.added) console.log(`    + ${p.name}: ${p.type}`);
    for (const p of diff.removed) {
      const note = p.replacement ? ` (replaced by ${p.replacement})` : '';
      console.log(`    - ${p.name}: ${p.type}${note}`);
    }
    for (const p of diff.changed) console.log(`    ~ ${p.name}: ${p.change}`);
    console.log('');
  }
}

// ── Command registration ──

export function registerChangelogCommand(program: Command): void {
  program
    .command('changelog [v1] [v2] [component]')
    .description('Query changelog or compare API differences between versions')
    .action((v1?: string, v2?: string, component?: string) => {
      const opts = program.opts<GlobalOptions>();

      const isChangelogMode = !v2 || (v1 && v1.includes('..'));

      if (isChangelogMode) {
        const v1ForDetect = v1?.includes('..') ? v1.split('..')[1] : v1;
        const versionForDetect = opts.version ?? (v1ForDetect && /^\d+\.\d+\.\d+$/.test(v1ForDetect) ? v1ForDetect : undefined);
        const versionInfo = detectVersion(versionForDetect);

        const result = queryChangelog({
          snapshotVersion: versionInfo.version,
          entryFilter: v1,
        });

        if ('error' in result) {
          // Special case: "No changelog data available" should just print a message, not a structured error
          if (result.code === ErrorCodes.VERSION_NOT_FOUND && !result.suggestion) {
            console.log('No changelog data available.');
            return;
          }
          printError(result, opts.format);
          process.exitCode = 1;
          return;
        }

        printChangelogEntries(result.entries, opts.format, result.versionArg);
      } else {
        const result = diffChangelog({ v1: v1!, v2: v2!, component });

        if ('error' in result) {
          printError(result, opts.format);
          process.exitCode = 1;
          return;
        }

        printApiDiff(result, opts.format);
      }
    });
}
