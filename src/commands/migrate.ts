import type { Command } from 'commander';
import type { GlobalOptions, OutputFormat } from '../types.js';
import { relative } from 'node:path';
import { localize } from '../types.js';
import { output } from '../output/formatter.js';
import { printError, createError, ErrorCodes } from '../output/error.js';
import { collectFiles, scanFile } from '../utils/scan.js';
import { V3_TO_V4_STEPS } from './migrate-v3-to-v4.js';
import { V4_TO_V5_STEPS } from './migrate-v4-to-v5.js';
import { V5_TO_V6_STEPS } from './migrate-v5-to-v6.js';

export interface MigrationStep {
  component: string;
  breaking: boolean;
  description: string;
  autoFixable: boolean;
  codemod?: string;
  guide?: string;
  /** Pattern to search for in source files (regex string) */
  searchPattern?: string;
  /** Before/after code examples for agents */
  before?: string;
  after?: string;
  /** Detailed migration instructions for agents */
  migrationGuide?: string;
}

// ─── Migration Guide Registry ────────────────────────────────────────────────

const MIGRATION_GUIDES: Record<string, MigrationStep[]> = {
  '3-4': V3_TO_V4_STEPS,
  '4-5': V4_TO_V5_STEPS,
  '5-6': V5_TO_V6_STEPS,
};

// ─── Output Formatters ──────────────────────────────────────────────────────

function formatText(from: string, to: string, steps: MigrationStep[], lang: string): void {
  const autoFixable = steps.filter((s) => s.autoFixable).length;
  const manual = steps.length - autoFixable;

  console.log(localize(
    `Migration Guide: v${from} → v${to}`,
    `迁移指南：v${from} → v${to}`,
    lang,
  ) + '\n');

  // Group by component
  const grouped = groupByComponent(steps);
  for (const [comp, compSteps] of grouped) {
    console.log(`  ${comp}:`);
    for (const step of compSteps) {
      const icon = step.autoFixable ? '🔧' : '📝';
      const breaking = step.breaking ? ' [BREAKING]' : '';
      console.log(`    ${icon}${breaking} ${step.description}`);
      if (step.guide) console.log(`       Guide: ${step.guide}`);
    }
    console.log('');
  }

  console.log(`${localize('Total:', '合计：', lang)} ${localize(`${steps.length} steps`, `${steps.length} 个步骤`, lang)} (${localize(`${autoFixable} auto-fixable`, `${autoFixable} 个可自动修复`, lang)}, ${localize(`${manual} manual`, `${manual} 个需手动处理`, lang)})`);
}

function formatMarkdown(from: string, to: string, steps: MigrationStep[]): void {
  const lines: string[] = [];
  const autoFixable = steps.filter((s) => s.autoFixable).length;
  const manual = steps.length - autoFixable;

  lines.push(`# Migration Guide: antd v${from} → v${to}`);
  lines.push('');
  lines.push(`> ${steps.length} total steps: ${autoFixable} auto-fixable, ${manual} manual`);
  lines.push('');

  const grouped = groupByComponent(steps);
  for (const [comp, compSteps] of grouped) {
    lines.push(`## ${comp}`);
    lines.push('');
    for (const step of compSteps) {
      const badge = step.breaking ? '**BREAKING**' : 'non-breaking';
      const fix = step.autoFixable ? '🔧 auto-fixable' : '📝 manual';
      lines.push(`### ${step.description}`);
      lines.push('');
      lines.push(`${badge} | ${fix}`);
      lines.push('');

      if (step.migrationGuide) {
        lines.push(step.migrationGuide);
        lines.push('');
      }

      if (step.before && step.after) {
        lines.push('**Before:**');
        lines.push('```tsx');
        lines.push(step.before);
        lines.push('```');
        lines.push('');
        lines.push('**After:**');
        lines.push('```tsx');
        lines.push(step.after);
        lines.push('```');
        lines.push('');
      }

      if (step.searchPattern) {
        lines.push(`**Search pattern:** \`${step.searchPattern}\``);
        lines.push('');
      }

      if (step.guide) {
        lines.push(`**Reference:** ${step.guide}`);
        lines.push('');
      }
    }
  }

  console.log(lines.join('\n'));
}

function formatJson(from: string, to: string, steps: MigrationStep[]): void {
  const autoFixable = steps.filter((s) => s.autoFixable).length;
  const manual = steps.length - autoFixable;
  output({
    from,
    to,
    steps,
    summary: { total: steps.length, autoFixable, manual },
  }, 'json');
}

const GLOBAL_COMPONENT = 'Global';

interface MigrationScanResult {
  fileCount: number;
  componentFiles: Map<string, string[]>;
  patternMatches: Map<string, string[]>;
}

function scanForMigration(dir: string, steps: MigrationStep[]): MigrationScanResult {
  const files = collectFiles(dir);
  const componentFiles = new Map<string, string[]>();
  const patternMatches = new Map<string, string[]>();

  const patternsToSearch = new Map<string, RegExp>();
  for (const step of steps) {
    if (step.searchPattern && !patternsToSearch.has(step.searchPattern)) {
      try {
        patternsToSearch.set(step.searchPattern, new RegExp(step.searchPattern));
      } catch { /* skip invalid regex */ }
    }
  }

  for (const file of files) {
    const { usage, content } = scanFile(file, { returnContent: patternsToSearch.size > 0 });
    for (const [name] of usage) {
      if (!componentFiles.has(name)) componentFiles.set(name, []);
      componentFiles.get(name)!.push(file);
    }

    if (content && usage.size > 0) {
      for (const [pattern, regex] of patternsToSearch) {
        if (regex.test(content)) {
          if (!patternMatches.has(pattern)) patternMatches.set(pattern, []);
          patternMatches.get(pattern)!.push(file);
        }
      }
    }
  }

  return { fileCount: files.length, componentFiles, patternMatches };
}

function getAffectedFiles(
  step: MigrationStep,
  scan: MigrationScanResult,
  relativePath: (f: string) => string,
): string[] {
  const patternFiles = step.searchPattern && scan.patternMatches.get(step.searchPattern);
  if (patternFiles && patternFiles.length > 0) return patternFiles.map(relativePath);
  if (step.component !== GLOBAL_COMPONENT) {
    const compFiles = scan.componentFiles.get(step.component);
    if (compFiles && compFiles.length > 0) return compFiles.map(relativePath);
  }
  return [];
}

function formatApplyPrompt(from: string, to: string, steps: MigrationStep[], dir: string, format: OutputFormat): void {
  const scan = scanForMigration(dir, steps);
  const usedComponents = new Set(scan.componentFiles.keys());

  const relevantSteps = steps.filter((s) =>
    s.component === GLOBAL_COMPONENT || usedComponents.has(s.component)
  );

  const fixableSteps = relevantSteps.filter((s) => s.autoFixable && s.searchPattern);
  const manualSteps = relevantSteps.filter((s) => !s.autoFixable);

  const relativePath = (file: string) => relative(process.cwd(), file);

  if (format === 'json') {
    const componentSummary: Record<string, string[]> = {};
    for (const [name, files] of scan.componentFiles) {
      componentSummary[name] = files.map(relativePath);
    }
    output({
      from,
      to,
      targetDir: dir,
      scan: {
        fileCount: scan.fileCount,
        components: componentSummary,
      },
      autoFixSteps: fixableSteps.map((s) => ({
        component: s.component,
        description: s.description,
        searchPattern: s.searchPattern,
        before: s.before,
        after: s.after,
        migrationGuide: s.migrationGuide,
        affectedFiles: getAffectedFiles(s, scan, relativePath),
      })),
      manualSteps: manualSteps.map((s) => ({
        component: s.component,
        description: s.description,
        guide: s.guide,
        migrationGuide: s.migrationGuide,
        before: s.before,
        after: s.after,
        affectedFiles: getAffectedFiles(s, scan, relativePath),
      })),
      summary: {
        totalAutoFix: fixableSteps.length,
        totalManual: manualSteps.length,
      },
    }, 'json');
    return;
  }

  const lines: string[] = [];
  lines.push(`# Auto-Migration Prompt: antd v${from} → v${to}`);
  lines.push(`# Target directory: ${dir}`);
  lines.push('');

  lines.push('## Scan Results');
  lines.push('');
  lines.push(`Scanned ${scan.fileCount} files in \`${dir}\``);
  lines.push('');
  if (scan.componentFiles.size > 0) {
    const compList = [...scan.componentFiles.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, files]) => `${name} (${files.length} files)`)
      .join(', ');
    lines.push(`**Detected antd components:** ${compList}`);
  } else {
    lines.push('**No antd component imports detected.**');
  }
  lines.push('');

  lines.push('## Instructions for Code Agent');
  lines.push('');
  lines.push('Apply the following migrations to the files listed below.');
  lines.push('For each file changed, verify the fix compiles correctly before moving on.');
  lines.push('');

  if (fixableSteps.length > 0) {
    lines.push('## Auto-fixable Changes');
    lines.push('');
    for (let i = 0; i < fixableSteps.length; i++) {
      const step = fixableSteps[i];
      lines.push(`### ${i + 1}. ${step.component}: ${step.description}`);
      lines.push('');
      pushAffectedFileLines(lines, getAffectedFiles(step, scan, relativePath), step);
      if (step.searchPattern) {
        lines.push(`**Search regex:** \`${step.searchPattern}\``);
        lines.push('');
      }
      if (step.migrationGuide) {
        lines.push(step.migrationGuide);
        lines.push('');
      }
      if (step.before && step.after) {
        lines.push('**Before:**', '```tsx', step.before, '```');
        lines.push('**After:**', '```tsx', step.after, '```');
        lines.push('');
      }
    }
  }

  if (manualSteps.length > 0) {
    lines.push('## Manual Changes (require human review)');
    lines.push('');
    for (let i = 0; i < manualSteps.length; i++) {
      const step = manualSteps[i];
      lines.push(`### ${i + 1}. ${step.component}: ${step.description}`);
      lines.push('');
      pushAffectedFileLines(lines, getAffectedFiles(step, scan, relativePath), step);
      if (step.migrationGuide) {
        lines.push(step.migrationGuide);
        lines.push('');
      }
      if (step.before && step.after) {
        lines.push('**Before:**', '```tsx', step.before, '```');
        lines.push('**After:**', '```tsx', step.after, '```');
        lines.push('');
      }
      if (step.guide) {
        lines.push(`**Reference:** ${step.guide}`);
        lines.push('');
      }
    }
  }

  console.log(lines.join('\n'));
}

function pushAffectedFileLines(lines: string[], files: string[], step: MigrationStep): void {
  if (files.length === 0) return;
  const label = step.searchPattern ? '**Affected files:**' : '**Files using this component:**';
  lines.push(label);
  for (const file of files) {
    lines.push(`- ${file}`);
  }
  lines.push('');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByComponent(steps: MigrationStep[]): Map<string, MigrationStep[]> {
  const map = new Map<string, MigrationStep[]>();
  for (const step of steps) {
    const arr = map.get(step.component) || [];
    arr.push(step);
    map.set(step.component, arr);
  }
  return map;
}

// ─── Command Registration ────────────────────────────────────────────────────

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate <from> <to>')
    .description('Version migration guide with optional auto-fix')
    .option('--component <name>', 'Component-specific migration guide (combinable with --apply)')
    .option('--apply <dir>', 'Scan directory and generate targeted migration prompts with affected files')
    .option('--confirm', 'Confirm auto-fix (required with --apply)')
    .action((rawFrom: string, rawTo: string, cmdOpts: { component?: string; apply?: string; confirm?: boolean }) => {
      const opts = program.opts<GlobalOptions>();
      const from = rawFrom.replace(/^v/i, '');
      const to = rawTo.replace(/^v/i, '');
      const key = `${from}-${to}`;
      let steps = MIGRATION_GUIDES[key];

      if (!steps) {
        const err = createError(
          ErrorCodes.INVALID_ARGUMENT,
          `No migration guide available for v${from} → v${to}`,
          `Available migrations: ${Object.keys(MIGRATION_GUIDES).map((k) => `v${k.replace('-', ' → v')}`).join(', ')}`,
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      if (cmdOpts.component) {
        steps = steps.filter((s) => s.component.toLowerCase() === cmdOpts.component!.toLowerCase());
        if (steps.length === 0) {
          const err = createError(
            ErrorCodes.COMPONENT_NOT_FOUND,
            `No migration steps found for ${cmdOpts.component} from v${from} to v${to}`,
          );
          printError(err, opts.format);
          process.exitCode = 1;
          return;
        }
      }

      // --apply mode: generate agent-consumable migration prompt
      if (cmdOpts.apply) {
        formatApplyPrompt(from, to, steps, cmdOpts.apply, opts.format);
        return;
      }

      // Standard guide output
      switch (opts.format) {
        case 'json':
          formatJson(from, to, steps);
          break;
        case 'markdown':
          formatMarkdown(from, to, steps);
          break;
        case 'text':
        default:
          formatText(from, to, steps, opts.lang);
          break;
      }
    });
}
