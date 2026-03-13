import type { MigrationStep } from './migrate.js';

export const V4_TO_V5_STEPS: MigrationStep[] = [
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

  // Slider
  {
    component: 'Slider',
    breaking: true,
    description: 'Tooltip-related APIs converged into `tooltip` property. `tooltipVisible` → `tooltip.open`, `tipFormatter` → `tooltip.formatter`, etc.',
    autoFixable: false,
    searchPattern: `<Slider[^>]*\\b(tooltipVisible|tipFormatter|tooltipPlacement|getTooltipPopupContainer)\\b`,
    before: `<Slider tooltipVisible={show} tipFormatter={(v) => \`\${v}%\`} />`,
    after: `<Slider tooltip={{ open: show, formatter: (v) => \`\${v}%\` }} />`,
    migrationGuide: `Migrate Slider tooltip props:
- tooltipVisible → tooltip.open
- tipFormatter → tooltip.formatter
- tooltipPlacement → tooltip.placement
- getTooltipPopupContainer → tooltip.getPopupContainer`,
  },

  // Table filterDropdownVisible
  {
    component: 'Table',
    breaking: true,
    description: 'Column prop `filterDropdownVisible` renamed to `filterDropdownOpen`.',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `filterDropdownVisible`,
    before: `{ title: 'Name', dataIndex: 'name', filterDropdownVisible: visible }`,
    after: `{ title: 'Name', dataIndex: 'name', filterDropdownOpen: visible }`,
    migrationGuide: `Search for \`filterDropdownVisible\` in Table column definitions and rename to \`filterDropdownOpen\`.`,
  },

  // Drawer style/className migration
  {
    component: 'Drawer',
    breaking: true,
    description: 'Drawer `style` and `className` now apply to the panel node. Use `rootStyle` and `rootClassName` for the wrapper.',
    autoFixable: false,
    searchPattern: `<Drawer[^>]*\\b(style|className)\\s*=`,
    migrationGuide: `In v5, Drawer \`style\` and \`className\` are migrated to the Drawer panel node.
If you were using them to style the wrapper/mask, replace with \`rootStyle\` and \`rootClassName\`.`,
    before: `<Drawer className="my-drawer" style={{ zIndex: 1000 }}>`,
    after: `<Drawer rootClassName="my-drawer" rootStyle={{ zIndex: 1000 }}>`,
  },

  // Notification close → destroy
  {
    component: 'notification',
    breaking: true,
    description: 'Static method `notification.close()` renamed to `notification.destroy()`. Static config options restricted.',
    autoFixable: false,
    searchPattern: `\\bnotification\\.close\\(`,
    before: `notification.close(key);`,
    after: `notification.destroy(key);`,
    migrationGuide: `1. Rename notification.close() to notification.destroy()
2. Static methods no longer allow dynamic prefixCls, maxCount, top, bottom, getContainer in open()
3. Use useNotification hook if you need different configurations`,
  },

  // message.warn removed
  {
    component: 'message',
    breaking: true,
    description: '`message.warn()` completely removed. Use `message.warning()` instead.',
    autoFixable: true,
    codemod: 'v5-props-changed-migration',
    searchPattern: `\\bmessage\\.warn\\(`,
    before: `message.warn('Something went wrong');`,
    after: `message.warning('Something went wrong');`,
    migrationGuide: `Search for \`message.warn(\` and replace with \`message.warning(\`.`,
  },

  // IE not supported
  {
    component: 'Global',
    breaking: true,
    description: 'IE browser is no longer supported. v5 uses CSS-in-JS and modern CSS features.',
    autoFixable: false,
    migrationGuide: `If your project needs IE support, you cannot upgrade to v5. Consider using @ant-design/cssinjs StyleProvider for :where selector compatibility with older browsers.`,
  },
];
