import type { Command } from 'commander';
import type { GlobalOptions, OutputFormat } from '../types.js';
import { output } from '../output/formatter.js';
import { printError, createError, ErrorCodes } from '../output/error.js';

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

// ─── v4 → v5 Migration Data ─────────────────────────────────────────────────

const V4_TO_V5_STEPS: MigrationStep[] = [
  // Global changes
  {
    component: 'Global',
    breaking: true,
    description: 'Design token system replaces Less variables. All Less variable overrides must be migrated to CSS-in-JS tokens via ConfigProvider.',
    autoFixable: false,
    guide: 'https://ant.design/docs/react/migrate-less-variables',
    migrationGuide: `1. Remove all Less variable overrides (modifyVars, less-loader theme config)
2. Wrap your app with ConfigProvider and pass a theme object
3. Map Less variables to Design Tokens (e.g. @primary-color → token.colorPrimary)
4. Remove babel-plugin-import if present (v5 supports tree-shaking natively)`,
    before: `// webpack.config.js or .umirc.ts
theme: { '@primary-color': '#1890ff' }

// or .less file
@import '~antd/dist/antd.less';
@primary-color: #1890ff;`,
    after: `import { ConfigProvider } from 'antd';
<ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
  <App />
</ConfigProvider>`,
  },
  {
    component: 'Global',
    breaking: true,
    description: 'Component styles no longer include CSS reset. Wrap app with <App /> component to restore.',
    autoFixable: false,
    guide: 'https://ant.design/components/app',
    searchPattern: `import\\s*\\{[^}]*\\}\\s*from\\s*['"]antd['"]`,
    migrationGuide: `1. Import App component from antd
2. Wrap your root component with <App />
3. Use App.useApp() hook to access message, notification, modal instances`,
    before: `import { Button } from 'antd';

const MyApp = () => <Button>Click</Button>;`,
    after: `import { App, Button } from 'antd';

const MyApp = () => (
  <App>
    <Button>Click</Button>
  </App>
);`,
  },
  {
    component: 'Global',
    breaking: true,
    description: 'Moment.js replaced by Day.js. All date-related components (DatePicker, TimePicker, Calendar) now use Day.js.',
    autoFixable: true,
    codemod: 'v5-removed-component-migration',
    searchPattern: `import\\s+moment\\s+from\\s+['"]moment['"]`,
    migrationGuide: `1. Replace moment imports with dayjs
2. dayjs API is mostly compatible with moment
3. If you need locale support, import dayjs locale separately
4. If you need plugins (isBetween, etc.), import and extend dayjs`,
    before: `import moment from 'moment';
<DatePicker value={moment('2024-01-01')} />`,
    after: `import dayjs from 'dayjs';
<DatePicker value={dayjs('2024-01-01')} />`,
  },
  {
    component: 'Global',
    breaking: true,
    description: 'babel-plugin-import is no longer needed. antd v5 supports tree-shaking natively.',
    autoFixable: false,
    searchPattern: `babel-plugin-import`,
    migrationGuide: `1. Remove babel-plugin-import from babel config
2. Remove related configuration in .babelrc, babel.config.js, or package.json
3. Direct imports like \`import { Button } from 'antd'\` work without the plugin`,
  },
  {
    component: 'Global',
    breaking: true,
    description: '`antd/dist/antd.css` and `antd/dist/antd.less` removed. CSS-in-JS generates styles automatically.',
    autoFixable: true,
    codemod: 'v5-removed-component-migration',
    searchPattern: `import\\s+['"]antd/dist/antd\\.(css|less)['"]`,
    migrationGuide: `Remove the global CSS/Less import. Styles are now injected via CSS-in-JS automatically.`,
    before: `import 'antd/dist/antd.css';
// or
import 'antd/dist/antd.less';`,
    after: `// No global import needed — styles are auto-injected`,
  },

  // Prop renames (visible → open)
  {
    component: 'Modal',
    breaking: true,
    description: 'Prop `visible` renamed to `open`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Modal[^>]*\\bvisible\\b`,
    before: `<Modal visible={show} onCancel={onClose}>`,
    after: `<Modal open={show} onCancel={onClose}>`,
    migrationGuide: `Search for \`<Modal\` with \`visible\` prop and rename to \`open\`. Also applies to Modal.confirm, Modal.info, etc.`,
  },
  {
    component: 'Drawer',
    breaking: true,
    description: 'Prop `visible` renamed to `open`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Drawer[^>]*\\bvisible\\b`,
    before: `<Drawer visible={show} onClose={onClose}>`,
    after: `<Drawer open={show} onClose={onClose}>`,
  },
  {
    component: 'Tooltip',
    breaking: true,
    description: 'Prop `visible` renamed to `open`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Tooltip[^>]*\\bvisible\\b`,
    before: `<Tooltip visible={show}>`,
    after: `<Tooltip open={show}>`,
  },
  {
    component: 'Popover',
    breaking: true,
    description: 'Prop `visible` renamed to `open`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Popover[^>]*\\bvisible\\b`,
    before: `<Popover visible={show}>`,
    after: `<Popover open={show}>`,
  },
  {
    component: 'Popconfirm',
    breaking: true,
    description: 'Prop `visible` renamed to `open`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Popconfirm[^>]*\\bvisible\\b`,
    before: `<Popconfirm visible={show}>`,
    after: `<Popconfirm open={show}>`,
  },
  {
    component: 'Dropdown',
    breaking: true,
    description: 'Prop `visible` renamed to `open`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Dropdown[^>]*\\bvisible\\b`,
    before: `<Dropdown visible={show}>`,
    after: `<Dropdown open={show}>`,
  },
  {
    component: 'Tag',
    breaking: true,
    description: 'Prop `visible` removed. Use conditional rendering instead.',
    autoFixable: false,
    searchPattern: `<Tag[^>]*\\bvisible\\b`,
    before: `<Tag visible={show}>Tag</Tag>`,
    after: `{show && <Tag>Tag</Tag>}`,
    migrationGuide: `Replace \`visible\` prop with conditional rendering using \`{condition && <Tag>...</Tag>}\`.`,
  },

  // dropdownClassName → popupClassName
  {
    component: 'Select',
    breaking: true,
    description: 'Prop `dropdownClassName` renamed to `popupClassName`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Select[^>]*\\bdropdownClassName\\b`,
    before: `<Select dropdownClassName="my-dropdown" />`,
    after: `<Select popupClassName="my-dropdown" />`,
  },
  {
    component: 'Select',
    breaking: true,
    description: 'Prop `dropdownMatchSelectWidth` renamed to `popupMatchSelectWidth`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Select[^>]*\\bdropdownMatchSelectWidth\\b`,
    before: `<Select dropdownMatchSelectWidth={false} />`,
    after: `<Select popupMatchSelectWidth={false} />`,
  },
  {
    component: 'TreeSelect',
    breaking: true,
    description: 'Prop `dropdownClassName` renamed to `popupClassName`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<TreeSelect[^>]*\\bdropdownClassName\\b`,
    before: `<TreeSelect dropdownClassName="my-dropdown" />`,
    after: `<TreeSelect popupClassName="my-dropdown" />`,
  },
  {
    component: 'Cascader',
    breaking: true,
    description: 'Prop `dropdownClassName` renamed to `popupClassName`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Cascader[^>]*\\bdropdownClassName\\b`,
    before: `<Cascader dropdownClassName="my-dropdown" />`,
    after: `<Cascader popupClassName="my-dropdown" />`,
  },
  {
    component: 'AutoComplete',
    breaking: true,
    description: 'Prop `dropdownClassName` renamed to `popupClassName`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<AutoComplete[^>]*\\bdropdownClassName\\b`,
    before: `<AutoComplete dropdownClassName="my-dropdown" />`,
    after: `<AutoComplete popupClassName="my-dropdown" />`,
  },
  {
    component: 'DatePicker',
    breaking: true,
    description: 'Prop `dropdownClassName` renamed to `popupClassName`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<DatePicker[^>]*\\bdropdownClassName\\b`,
    before: `<DatePicker dropdownClassName="my-popup" />`,
    after: `<DatePicker popupClassName="my-popup" />`,
  },
  {
    component: 'TimePicker',
    breaking: true,
    description: 'Prop `dropdownClassName` renamed to `popupClassName`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<TimePicker[^>]*\\bdropdownClassName\\b`,
    before: `<TimePicker dropdownClassName="my-popup" />`,
    after: `<TimePicker popupClassName="my-popup" />`,
  },
  {
    component: 'Mentions',
    breaking: true,
    description: 'Prop `dropdownClassName` renamed to `popupClassName`',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `<Mentions[^>]*\\bdropdownClassName\\b`,
    before: `<Mentions dropdownClassName="my-dropdown" />`,
    after: `<Mentions popupClassName="my-dropdown" />`,
  },

  // Removed components
  {
    component: 'Comment',
    breaking: true,
    description: 'Removed from antd. Use @ant-design/compatible instead.',
    autoFixable: false,
    guide: 'https://ant.design/docs/react/migration-v5',
    searchPattern: `import\\s*\\{[^}]*\\bComment\\b[^}]*\\}\\s*from\\s*['"]antd['"]`,
    migrationGuide: `1. Install @ant-design/compatible: npm install @ant-design/compatible
2. Change import from 'antd' to '@ant-design/compatible'`,
    before: `import { Comment } from 'antd';`,
    after: `import { Comment } from '@ant-design/compatible';`,
  },
  {
    component: 'PageHeader',
    breaking: true,
    description: 'Removed from antd. Use @ant-design/pro-components instead.',
    autoFixable: false,
    guide: 'https://ant.design/docs/react/migration-v5',
    searchPattern: `import\\s*\\{[^}]*\\bPageHeader\\b[^}]*\\}\\s*from\\s*['"]antd['"]`,
    migrationGuide: `1. Install @ant-design/pro-components: npm install @ant-design/pro-components
2. Change import from 'antd' to '@ant-design/pro-components'`,
    before: `import { PageHeader } from 'antd';`,
    after: `import { PageHeader } from '@ant-design/pro-components';`,
  },
  {
    component: 'BackTop',
    breaking: true,
    description: 'Removed. Use FloatButton.BackTop instead.',
    autoFixable: true,
    codemod: 'v5-removed-component-migration',
    searchPattern: `import\\s*\\{[^}]*\\bBackTop\\b[^}]*\\}\\s*from\\s*['"]antd['"]`,
    before: `import { BackTop } from 'antd';
<BackTop />`,
    after: `import { FloatButton } from 'antd';
<FloatButton.BackTop />`,
  },

  // API changes
  {
    component: 'message',
    breaking: true,
    description: 'Static methods `message.xxx()` deprecated. Use `App.useApp()` hook instead for context support.',
    autoFixable: false,
    searchPattern: `\\bmessage\\.(success|error|warning|info|loading|open)\\(`,
    migrationGuide: `1. Wrap app with <App /> component
2. Use const { message } = App.useApp(); in functional components
3. Replace static message.xxx() calls with the hook-provided instance`,
    before: `import { message } from 'antd';
message.success('Done!');`,
    after: `import { App } from 'antd';
const MyComponent = () => {
  const { message } = App.useApp();
  message.success('Done!');
};`,
  },
  {
    component: 'notification',
    breaking: true,
    description: 'Static methods `notification.xxx()` deprecated. Use `App.useApp()` hook instead.',
    autoFixable: false,
    searchPattern: `\\bnotification\\.(success|error|warning|info|open)\\(`,
    migrationGuide: `Same pattern as message — use App.useApp() to get notification instance.`,
    before: `import { notification } from 'antd';
notification.success({ message: 'Done!' });`,
    after: `import { App } from 'antd';
const MyComponent = () => {
  const { notification } = App.useApp();
  notification.success({ message: 'Done!' });
};`,
  },
  {
    component: 'Modal',
    breaking: true,
    description: 'Static methods `Modal.confirm()` etc. deprecated. Use `App.useApp()` hook instead.',
    autoFixable: false,
    searchPattern: `\\bModal\\.(confirm|info|success|error|warning)\\(`,
    migrationGuide: `Same pattern as message/notification — use App.useApp() to get modal instance.`,
    before: `import { Modal } from 'antd';
Modal.confirm({ title: 'Sure?' });`,
    after: `import { App } from 'antd';
const MyComponent = () => {
  const { modal } = App.useApp();
  modal.confirm({ title: 'Sure?' });
};`,
  },

  // Table
  {
    component: 'Table',
    breaking: true,
    description: 'Column `filterDropdown` render args changed. `confirm({ closeDropdown: false })` replaced by separate `close` function.',
    autoFixable: false,
    searchPattern: `filterDropdown.*closeDropdown`,
    migrationGuide: `Update filterDropdown render function signature to use the new \`close\` parameter instead of \`confirm({ closeDropdown: false })\`.`,
    before: `filterDropdown: ({ confirm }) => (
  <Button onClick={() => confirm({ closeDropdown: false })}>Filter</Button>
)`,
    after: `filterDropdown: ({ confirm, close }) => (
  <Button onClick={() => close()}>Filter</Button>
)`,
  },

  // Form
  {
    component: 'Form',
    breaking: false,
    description: 'Prop `labelCol` and `wrapperCol` can now be set globally via ConfigProvider.',
    autoFixable: false,
    migrationGuide: `Optional improvement: move repeated labelCol/wrapperCol config to ConfigProvider for consistency.`,
  },
];

// ─── v5 → v6 Migration Data ─────────────────────────────────────────────────

const V5_TO_V6_STEPS: MigrationStep[] = [
  {
    component: 'Button',
    breaking: true,
    description: 'Prop `type` split into `color` and `variant` for styling. `type="primary"` → `color="primary" variant="solid"`.',
    autoFixable: true,
    codemod: 'v6-type-to-variant',
    searchPattern: `<Button[^>]*\\btype\\s*=\\s*['"](?:primary|dashed|link|text)['"]`,
    migrationGuide: `Button type prop is decomposed:
- type="primary" → color="primary" variant="solid" (or just keep type="primary" as alias)
- type="dashed" → variant="dashed"
- type="link" → variant="link"
- type="text" → variant="text"
- type="default" → no change needed`,
    before: `<Button type="primary">Submit</Button>
<Button type="dashed">Dashed</Button>
<Button type="link">Link</Button>
<Button type="text">Text</Button>`,
    after: `<Button color="primary" variant="solid">Submit</Button>
<Button variant="dashed">Dashed</Button>
<Button variant="link">Link</Button>
<Button variant="text">Text</Button>`,
  },
  {
    component: 'Button',
    breaking: true,
    description: 'Prop `danger` removed. Use `color="danger"` instead.',
    autoFixable: true,
    codemod: 'v6-danger-migration',
    searchPattern: `<Button[^>]*\\bdanger\\b`,
    before: `<Button danger>Delete</Button>
<Button type="primary" danger>Delete</Button>`,
    after: `<Button color="danger">Delete</Button>
<Button color="danger" variant="solid">Delete</Button>`,
    migrationGuide: `Search for all Button components with \`danger\` prop. Replace with \`color="danger"\`. If the button also had \`type="primary"\`, add \`variant="solid"\`.`,
  },
  {
    component: 'Button',
    breaking: true,
    description: 'Prop `ghost` removed. Use `variant="outlined"` instead.',
    autoFixable: true,
    codemod: 'v6-ghost-migration',
    searchPattern: `<Button[^>]*\\bghost\\b`,
    before: `<Button ghost>Ghost</Button>
<Button type="primary" ghost>Ghost Primary</Button>`,
    after: `<Button variant="outlined">Ghost</Button>
<Button color="primary" variant="outlined">Ghost Primary</Button>`,
    migrationGuide: `Search for all Button components with \`ghost\` prop. Replace with \`variant="outlined"\`. Preserve the color from the original \`type\` prop.`,
  },
];

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
