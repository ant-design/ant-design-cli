import type { Command } from 'commander';
import type { GlobalOptions, OutputFormat } from '../types.js';
import { output } from '../output/formatter.js';
import { printError, createError, ErrorCodes } from '../output/error.js';
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

function formatApplyPrompt(from: string, to: string, steps: MigrationStep[], dir: string, format: OutputFormat): void {
  const fixableSteps = steps.filter((s) => s.autoFixable && s.searchPattern);
  const manualSteps = steps.filter((s) => !s.autoFixable);

  if (format === 'json') {
    output({
      from,
      to,
      targetDir: dir,
      autoFixSteps: fixableSteps.map((s) => ({
        component: s.component,
        description: s.description,
        searchPattern: s.searchPattern,
        before: s.before,
        after: s.after,
        migrationGuide: s.migrationGuide,
      })),
      manualSteps: manualSteps.map((s) => ({
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
      },
    }, 'json');
    return;
  }

  const lines: string[] = [];
  lines.push(`# Auto-Migration Prompt: antd v${from} → v${to}`);
  lines.push(`# Target directory: ${dir}`);
  lines.push('');
  lines.push('## Instructions for Code Agent');
  lines.push('');
  lines.push(`Scan all .ts/.tsx/.js/.jsx files in \`${dir}\` and apply the following migrations.`);
  lines.push('For each file changed, verify the fix compiles correctly before moving on.');
  lines.push('');

  if (fixableSteps.length > 0) {
    lines.push('## Auto-fixable Changes');
    lines.push('');
    for (let i = 0; i < fixableSteps.length; i++) {
      const step = fixableSteps[i];
      lines.push(`### ${i + 1}. ${step.component}: ${step.description}`);
      lines.push('');
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
    }
  }

  if (manualSteps.length > 0) {
    lines.push('## Manual Changes (require human review)');
    lines.push('');
    for (let i = 0; i < manualSteps.length; i++) {
      const step = manualSteps[i];
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
    .option('--apply <dir>', 'Generate migration prompts for scanning a directory')
    .option('--confirm', 'Confirm auto-fix (required with --apply)')
    .action((from: string, to: string, cmdOpts: { component?: string; apply?: string; confirm?: boolean }) => {
      const opts = program.opts<GlobalOptions>();
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
          formatText(from, to, steps);
          break;
      }
    });
}
