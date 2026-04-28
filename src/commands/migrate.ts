import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { Command } from 'commander';
import type { GlobalOptions, OutputFormat } from '../types.js';
import { output } from '../output/formatter.js';
import { printError, createError, ErrorCodes } from '../output/error.js';
import { collectFiles } from '../utils/scan.js';
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

function formatText(from: string, to: string, steps: MigrationStep[]): void {
  const autoFixable = steps.filter((s) => s.autoFixable).length;
  const manual = steps.length - autoFixable;

  console.log(`Migration Guide: v${from} → v${to}\n`);

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

  console.log(`Total: ${steps.length} steps (${autoFixable} auto-fixable, ${manual} manual)`);
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

function formatApplyPrompt(from: string, to: string, steps: StepWithMatches[], dir: string, format: OutputFormat): void {
  const hasPattern = steps.some((s) => s.searchPattern);
  const fixableSteps = steps.filter((s) => s.autoFixable && s.searchPattern);
  const manualSteps = steps.filter((s) => !s.autoFixable && s.searchPattern);
  const generalSteps = steps.filter((s) => !s.searchPattern);

  if (format === 'json') {
    output({
      from,
      to,
      targetDir: dir,
      scannedFiles: hasPattern ? collectFiles(dir).map((f) => relative(dir, f)).length : 0,
      autoFixSteps: fixableSteps.map((s) => ({
        component: s.component,
        description: s.description,
        searchPattern: s.searchPattern,
        matchedFiles: s.matchedFiles,
        before: s.before,
        after: s.after,
        migrationGuide: s.migrationGuide,
      })),
      manualSteps: manualSteps.map((s) => ({
        component: s.component,
        description: s.description,
        searchPattern: s.searchPattern,
        matchedFiles: s.matchedFiles,
        guide: s.guide,
        migrationGuide: s.migrationGuide,
        before: s.before,
        after: s.after,
      })),
      generalSteps: generalSteps.map((s) => ({
        component: s.component,
        description: s.description,
        guide: s.guide,
        migrationGuide: s.migrationGuide,
        before: s.before,
        after: s.after,
      })),
      summary: {
        totalAutoFix: fixableSteps.length,
        totalManual: manualSteps.length,
        totalGeneral: generalSteps.length,
        matchedAutoFix: fixableSteps.filter((s) => s.matchedFiles.length > 0).length,
        matchedManual: manualSteps.filter((s) => s.matchedFiles.length > 0).length,
      },
    }, 'json');
    return;
  }

  const lines: string[] = [];
  lines.push(`# Auto-Migration Prompt: antd v${from} → v${to}`);
  lines.push(`# Target directory: ${dir}`);

  if (hasPattern) {
    const fileCount = collectFiles(dir).length;
    lines.push(`# Scanned ${fileCount} source files`);
  }
  lines.push('');
  lines.push('## Instructions for Code Agent');
  lines.push('');
  if (hasPattern) {
    lines.push(`The source files in \`${dir}\` have been scanned. Only migration steps with matching patterns in your code are listed below.`);
  } else {
    lines.push(`Scan all .ts/.tsx/.js/.jsx files in \`${dir}\` and apply the following migrations.`);
  }
  lines.push('For each file changed, verify the fix compiles correctly before moving on.');
  lines.push('');

  // Auto-fixable steps with matches
  const matchedFixable = fixableSteps.filter((s) => s.matchedFiles.length > 0);
  const unmatchedFixable = fixableSteps.filter((s) => s.matchedFiles.length === 0);

  if (matchedFixable.length > 0) {
    lines.push('## Auto-fixable Changes (matched in your code)');
    lines.push('');
    for (let i = 0; i < matchedFixable.length; i++) {
      const step = matchedFixable[i];
      appendStepWithFiles(lines, i + 1, step);
    }
  }

  if (unmatchedFixable.length > 0) {
    lines.push('## Auto-fixable Changes (not found in your code)');
    lines.push('');
    lines.push('The following patterns were not detected in your source files. You can skip these.');
    lines.push('');
    for (let i = 0; i < unmatchedFixable.length; i++) {
      const step = unmatchedFixable[i];
      lines.push(`- ${step.component}: ${step.description}`);
    }
    lines.push('');
  }

  // Manual steps with matches
  const matchedManual = manualSteps.filter((s) => s.matchedFiles.length > 0);
  const unmatchedManual = manualSteps.filter((s) => s.matchedFiles.length === 0);

  if (matchedManual.length > 0) {
    lines.push('## Manual Changes (matched in your code — require human review)');
    lines.push('');
    for (let i = 0; i < matchedManual.length; i++) {
      const step = matchedManual[i];
      appendStepWithFiles(lines, i + 1, step);
    }
  }

  if (unmatchedManual.length > 0) {
    lines.push('## Manual Changes (not found in your code)');
    lines.push('');
    lines.push('The following patterns were not detected. You can skip these.');
    lines.push('');
    for (let i = 0; i < unmatchedManual.length; i++) {
      const step = unmatchedManual[i];
      lines.push(`- ${step.component}: ${step.description}`);
    }
    lines.push('');
  }

  // General steps (no searchPattern — always applicable)
  if (generalSteps.length > 0) {
    lines.push('## General Changes (always applicable)');
    lines.push('');
    lines.push('These changes have no search pattern and may apply regardless of source code content:');
    lines.push('');
    for (let i = 0; i < generalSteps.length; i++) {
      const step = generalSteps[i];
      lines.push(`### ${i + 1}. ${step.component}: ${step.description}`);
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
        lines.push('**After:**');
        lines.push('```tsx');
        lines.push(step.after);
        lines.push('```');
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

function appendStepWithFiles(lines: string[], index: number, step: StepWithMatches): void {
  lines.push(`### ${index}. ${step.component}: ${step.description}`);
  lines.push('');
  if (step.matchedFiles.length > 0) {
    lines.push(`**Matched files (${step.matchedFiles.length}):**`);
    for (const f of step.matchedFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }
  if (step.searchPattern) {
    lines.push(`**Search regex:** \`${step.searchPattern}\``);
    lines.push('');
  }
  if (step.migrationGuide) {
    lines.push(step.migrationGuide);
    lines.push('');
  }
  if (step.before && step.after) {
    lines.push('**Before:**');
    lines.push('```tsx');
    lines.push(step.before);
    lines.push('```');
    lines.push('**After:**');
    lines.push('```tsx');
    lines.push(step.after);
    lines.push('```');
    lines.push('');
  }
  if (step.guide) {
    lines.push(`**Reference:** ${step.guide}`);
    lines.push('');
  }
}

// ─── Source Scanning ────────────────────────────────────────────────────────

interface StepWithMatches extends MigrationStep {
  matchedFiles: string[];
}

function scanDirForSteps(dir: string, steps: MigrationStep[]): StepWithMatches[] {
  const files = collectFiles(dir);
  if (files.length === 0) {
    return steps.map((s) => ({ ...s, matchedFiles: [] }));
  }

  const fileContents = new Map<string, string>();
  for (const f of files) {
    try {
      fileContents.set(f, readFileSync(f, 'utf-8'));
    } catch {
      // skip unreadable files
    }
  }

  return steps.map((step) => {
    if (!step.searchPattern) {
      return { ...step, matchedFiles: [] };
    }
    const re = new RegExp(step.searchPattern, 'm');
    const matchedFiles: string[] = [];
    for (const [filePath, content] of fileContents) {
      if (re.test(content)) {
        matchedFiles.push(relative(dir, filePath));
      }
    }
    return { ...step, matchedFiles };
  });
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
    .option('--component <name>', 'Component-specific migration guide')
    .option('--apply <dir>', 'Scan source directory and generate targeted migration prompts')
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

      // --apply mode: scan source directory and generate targeted migration prompt
      if (cmdOpts.apply) {
        const scannedSteps = scanDirForSteps(cmdOpts.apply, steps);
        formatApplyPrompt(from, to, scannedSteps, cmdOpts.apply, opts.format);
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
          formatText(from, to, steps);
          break;
      }
    });
}
