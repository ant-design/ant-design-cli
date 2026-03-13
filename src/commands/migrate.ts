import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { output } from '../output/formatter.js';

interface MigrationStep {
  component: string;
  breaking: boolean;
  description: string;
  autoFixable: boolean;
  codemod?: string;
  guide?: string;
}

// Hardcoded migration guides — will eventually come from @ant-design/metadata
const MIGRATION_GUIDES: Record<string, MigrationStep[]> = {
  '4-5': [
    { component: 'Global', breaking: true, description: 'Less variables removed, use Design Token instead', autoFixable: false, guide: 'https://ant.design/docs/react/migrate-less-variables' },
    { component: 'Global', breaking: true, description: 'Component styles no longer include reset styles, add `<App />` wrapper', autoFixable: false, guide: 'https://ant.design/components/app' },
    { component: 'Select', breaking: true, description: 'Prop `dropdownClassName` renamed to `popupClassName`', autoFixable: true, codemod: 'v5-props-changed-migration' },
    { component: 'Select', breaking: true, description: 'Prop `dropdownMatchSelectWidth` renamed to `popupMatchSelectWidth`', autoFixable: true, codemod: 'v5-props-changed-migration' },
    { component: 'Modal', breaking: true, description: 'Prop `visible` renamed to `open`', autoFixable: true, codemod: 'v5-props-changed-migration' },
    { component: 'Drawer', breaking: true, description: 'Prop `visible` renamed to `open`', autoFixable: true, codemod: 'v5-props-changed-migration' },
    { component: 'Tooltip', breaking: true, description: 'Prop `visible` renamed to `open`', autoFixable: true, codemod: 'v5-props-changed-migration' },
    { component: 'Popover', breaking: true, description: 'Prop `visible` renamed to `open`', autoFixable: true, codemod: 'v5-props-changed-migration' },
    { component: 'Popconfirm', breaking: true, description: 'Prop `visible` renamed to `open`', autoFixable: true, codemod: 'v5-props-changed-migration' },
    { component: 'DatePicker', breaking: true, description: 'Migrated from moment.js to dayjs', autoFixable: true, codemod: 'v5-removed-component-migration' },
    { component: 'Comment', breaking: true, description: 'Removed, use @ant-design/compatible', autoFixable: false, guide: 'https://ant.design/docs/react/migration-v5' },
    { component: 'PageHeader', breaking: true, description: 'Removed, use @ant-design/pro-components', autoFixable: false, guide: 'https://ant.design/docs/react/migration-v5' },
    { component: 'BackTop', breaking: true, description: 'Removed, use FloatButton.BackTop', autoFixable: true, codemod: 'v5-removed-component-migration' },
  ],
  '5-6': [
    { component: 'Button', breaking: true, description: 'Prop `type` combined with `color` and `variant` for styling', autoFixable: true, codemod: 'v6-type-to-variant' },
    { component: 'Button', breaking: true, description: 'Prop `danger` removed, use `color="danger"` instead', autoFixable: true, codemod: 'v6-danger-migration' },
    { component: 'Button', breaking: true, description: 'Prop `ghost` removed, use `variant="outlined"` instead', autoFixable: true, codemod: 'v6-ghost-migration' },
  ],
};

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate <from> <to>')
    .description('Version migration guide with optional auto-fix')
    .option('--component <name>', 'Component-specific migration guide')
    .option('--apply <dir>', 'Auto-fix source files (dry-run by default)')
    .option('--confirm', 'Confirm auto-fix (required with --apply)')
    .action((from: string, to: string, cmdOpts: { component?: string; apply?: string; confirm?: boolean }) => {
      const opts = program.opts<GlobalOptions>();
      const key = `${from}-${to}`;
      let steps = MIGRATION_GUIDES[key];

      if (!steps) {
        console.error(`No migration guide available for v${from} → v${to}.`);
        console.error(`Available migrations: ${Object.keys(MIGRATION_GUIDES).map((k) => k.replace('-', ' → v')).join(', ')}`);
        process.exitCode = 1;
        return;
      }

      if (cmdOpts.component) {
        steps = steps.filter((s) => s.component.toLowerCase() === cmdOpts.component!.toLowerCase());
        if (steps.length === 0) {
          console.log(`No migration steps found for ${cmdOpts.component} from v${from} to v${to}.`);
          return;
        }
      }

      if (cmdOpts.apply) {
        if (!cmdOpts.confirm) {
          console.log('Dry-run mode (add --confirm to apply changes):\n');
          const fixable = steps.filter((s) => s.autoFixable);
          for (const step of fixable) {
            console.log(`  Would fix: ${step.component} — ${step.description}`);
            if (step.codemod) console.log(`    Codemod: ${step.codemod}`);
          }
          console.log(`\n${fixable.length} auto-fixable steps. Run with --confirm to apply.`);
          return;
        }

        console.log('Auto-fix is not yet implemented.');
        console.log('This will delegate to @ant-design/codemod packages in the future.');
        return;
      }

      const autoFixable = steps.filter((s) => s.autoFixable).length;
      const manual = steps.length - autoFixable;

      if (opts.format === 'json') {
        output({
          from,
          to,
          steps,
          summary: { total: steps.length, autoFixable, manual },
        }, 'json');
        return;
      }

      console.log(`Migration Guide: v${from} → v${to}\n`);

      for (const step of steps) {
        const icon = step.autoFixable ? '🔧' : '📝';
        const breaking = step.breaking ? ' [BREAKING]' : '';
        console.log(`  ${icon} ${step.component}${breaking}`);
        console.log(`    ${step.description}`);
        if (step.guide) console.log(`    Guide: ${step.guide}`);
        if (step.codemod) console.log(`    Codemod: ${step.codemod}`);
      }

      console.log(`\nTotal: ${steps.length} steps (${autoFixable} auto-fixable, ${manual} manual)`);
    });
}
