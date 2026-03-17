import type { Command } from 'commander';
import type { GlobalOptions, ComponentData, PropData, ChangelogEntry } from '../types.js';
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

function printChangelog(entries: ChangelogEntry[], format: string, versionArg?: string): void {
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

// ── API diff logic ──

interface PropDiff {
  name: string;
  type?: string;
  replacement?: string;
  change?: string;
}

interface ComponentDiff {
  component: string;
  added: PropDiff[];
  removed: PropDiff[];
  changed: PropDiff[];
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

function runApiDiff(
  v1: string,
  v2: string,
  component: string | undefined,
  opts: GlobalOptions,
): void {
  const store1 = loadMetadataForVersion(v1);
  const store2 = loadMetadataForVersion(v2);

  if (store1.components.length === 0) {
    printError(createError(ErrorCodes.VERSION_NOT_FOUND, `No data available for version ${v1}`), opts.format);
    process.exitCode = 1;
    return;
  }
  if (store2.components.length === 0) {
    printError(createError(ErrorCodes.VERSION_NOT_FOUND, `No data available for version ${v2}`), opts.format);
    process.exitCode = 1;
    return;
  }

  const componentsToCompare: string[] = component
    ? [component]
    : [...new Set([...getAllComponentNames(store1), ...getAllComponentNames(store2)])];

  if (component) {
    const c1 = findComponent(store1, component);
    const c2 = findComponent(store2, component);
    if (!c1 && !c2) {
      const allNames = [...new Set([...getAllComponentNames(store1), ...getAllComponentNames(store2)])];
      const suggestion = fuzzyMatch(component, allNames);
      printError(
        createError(ErrorCodes.COMPONENT_NOT_FOUND, `Component '${component}' not found in either version`, suggestion ? `Did you mean '${suggestion}'?` : undefined),
        opts.format,
      );
      process.exitCode = 1;
      return;
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

  if (opts.format === 'json') {
    const result = component && diffs.length > 0
      ? { from: v1, to: v2, ...diffs[0] }
      : { from: v1, to: v2, diffs };
    output(result, 'json');
    return;
  }

  if (diffs.length === 0) {
    console.log(`No API differences found between ${v1} and ${v2}.`);
    return;
  }

  console.log(`API Diff: ${v1} → ${v2}`);
  console.log('');
  for (const diff of diffs) {
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

      // Determine mode:
      //   antd diff                    → latest changelog
      //   antd diff 5.21.0             → single version changelog
      //   antd diff 5.20.0..5.22.0     → version range changelog
      //   antd diff 5.20.0 5.22.0      → API diff between two versions
      //   antd diff 5.20.0 5.22.0 Btn  → API diff for specific component

      const isChangelogMode = !v2 || (v1 && v1.includes('..'));

      if (isChangelogMode) {
        // Changelog mode — infer major version from the version argument if not explicitly overridden
        // For ranges like "6.1.0..6.3.0", extract the left-hand version to determine major
        const v1ForDetect = v1?.includes('..') ? v1.split('..')[0] : v1;
        const versionForDetect = opts.version ?? (v1ForDetect && /^\d+\.\d+\.\d+$/.test(v1ForDetect) ? v1ForDetect : undefined);
        const versionInfo = detectVersion(versionForDetect);
        const store = loadMetadataForVersion(versionInfo.version);
        const changelog = store.changelog || [];

        if (changelog.length === 0) {
          console.log('No changelog data available.');
          return;
        }

        const entries = filterEntries(changelog, v1);
        if (entries.length === 0) {
          const err = createError(
            ErrorCodes.VERSION_NOT_FOUND,
            `No changelog entries found for "${v1}"`,
            `Available versions: ${changelog.map((e) => e.version).join(', ')}`,
          );
          printError(err, opts.format);
          process.exitCode = 1;
          return;
        }

        printChangelog(entries, opts.format, v1);
      } else {
        // API diff mode — validate version order
        if (compare(v1!, v2!) > 0) {
          const err = createError(
            ErrorCodes.INVALID_ARGUMENT,
            `Version order is invalid: "${v1}" is newer than "${v2}"`,
            `Did you mean: antd changelog ${v2} ${v1}${component ? ' ' + component : ''}?`,
          );
          printError(err, opts.format);
          process.exitCode = 1;
          return;
        }
        runApiDiff(v1!, v2!, component, opts);
      }
    });
}
