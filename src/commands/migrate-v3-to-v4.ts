import type { MigrationStep } from './migrate.js';

export const V3_TO_V4_STEPS: MigrationStep[] = [
  // Global changes
  {
    component: 'Global',
    breaking: true,
    description: 'React 15 support dropped. Minimum React version is 16.0.0.',
    autoFixable: false,
    migrationGuide: `1. Upgrade React to 16.0.0 or higher
2. Update related dependencies (react-dom, react-router, etc.)
3. Refactor deprecated React 15 APIs if any (e.g., createClass → class)`,
  },
  {
    component: 'Global',
    breaking: true,
    description: 'IE9/IE10 support dropped. IE11 is the minimum supported version.',
    autoFixable: false,
    migrationGuide: `If you need IE9/IE10 support, stay on antd v3.x.`,
  },
  {
    component: 'Global',
    breaking: true,
    description: 'Less variables are no longer the primary customization method. v4 prepares for CSS-in-JS transition.',
    autoFixable: false,
    guide: 'https://ant.design/docs/react/migration-v4',
    migrationGuide: `v4 still supports Less variables but encourages ConfigProvider theme mode.
This is preparation for v5 where Less will be completely replaced.`,
  },

  // Icon - Major breaking change
  {
    component: 'Icon',
    breaking: true,
    description: 'Icon with string `type` prop removed. Use @ant-design/icons components instead.',
    autoFixable: false,
    guide: 'https://ant.design/docs/react/migrate-v4#icon',
    searchPattern: `<Icon\\s+type=`,
    migrationGuide: `1. Install @ant-design/icons: npm install @ant-design/icons
2. Import specific icon components instead of using Icon with type prop
3. Map string type to the corresponding icon component`,
    before: `import { Icon } from 'antd';

<Icon type="home" />
<Icon type="search" />
<Icon type="setting" theme="filled" />`,
    after: `import { HomeOutlined, SearchOutlined, SettingFilled } from '@ant-design/icons';

<HomeOutlined />
<SearchOutlined />
<SettingFilled />`,
  },
  {
    component: 'Icon',
    breaking: true,
    description: 'Icon.createFromIconfontCN() moved to @ant-design/icons.',
    autoFixable: false,
    searchPattern: `Icon\\.createFromIconfontCN`,
    before: `import { Icon } from 'antd';
const MyIcon = Icon.createFromIconfontCN({ scriptUrl: '...' });`,
    after: `import { createFromIconfontCN } from '@ant-design/icons';
const MyIcon = createFromIconfontCN({ scriptUrl: '...' });`,
  },

  // Mention
  {
    component: 'Mention',
    breaking: true,
    description: 'Mention component removed. Use Mentions instead.',
    autoFixable: false,
    guide: 'https://ant.design/components/mentions',
    searchPattern: `import\\s*\\{[^}]*\\bMention\\b[^}]*\\}\\s*from\\s*['"]antd['"]`,
    migrationGuide: `1. Change import from Mention to Mentions
2. Rename JSX tag from <Mention> to <Mentions>
3. Update prop names: getSuggestionContainer → getPopupContainer`,
    before: `import { Mention } from 'antd';
<Mention
  suggestions={['afc163', 'raoenhui']}
  getSuggestionContainer={() => document.body}
/>`,
    after: `import { Mentions } from 'antd';
<Mentions
  options={[
    { value: 'afc163', label: 'afc163' },
    { value: 'raoenhui', label: 'raoenhui' },
  ]}
  getPopupContainer={() => document.body}
/>`,
  },

  // Form - Major changes
  {
    component: 'Form',
    breaking: true,
    description: 'Form.create() HOC removed. Use Form.useForm() hook instead.',
    autoFixable: false,
    guide: 'https://ant.design/docs/react/migration-v4#form',
    searchPattern: `Form\\.create\\(`,
    migrationGuide: `1. Convert class components to functional components (recommended)
2. Use Form.useForm() hook to get form instance
3. Remove Form.create() wrapper`,
    before: `class MyForm extends React.Component {
  handleSubmit = () => {
    this.props.form.validateFields((err, values) => {
      // ...
    });
  }
  render() {
    const { form } = this.props;
    return <Form>{/* ... */}</Form>;
  }
}
export default Form.create()(MyForm);`,
    after: `const MyForm = () => {
  const [form] = Form.useForm();
  const handleSubmit = () => {
    form.validateFields().then(values => {
      // ...
    });
  };
  return <Form form={form}>{/* ... */}</Form>;
};
export default MyForm;`,
  },
  {
    component: 'Form',
    breaking: true,
    description: 'getFieldDecorator removed. Use Form.Item name prop instead.',
    autoFixable: false,
    searchPattern: `getFieldDecorator\\(`,
    migrationGuide: `Replace getFieldDecorator with Form.Item name prop.
The field value is now automatically managed by Form.`,
    before: `<Form.Item label="Username">
  {getFieldDecorator('username', {
    rules: [{ required: true }],
  })(<Input />)}
</Form.Item>`,
    after: `<Form.Item label="Username" name="username" rules={[{ required: true }]}>
  <Input />
</Form.Item>`,
  },
  {
    component: 'Form',
    breaking: true,
    description: 'autoFormCreate prop removed from Form. Use Form.useForm() hook.',
    autoFixable: false,
    searchPattern: `autoFormCreate`,
  },
  {
    component: 'Form.Item',
    breaking: true,
    description: 'fieldId prop removed. Form.Item automatically generates id.',
    autoFixable: false,
  },

  // BackTop
  {
    component: 'BackTop',
    breaking: false,
    description: 'BackTop is still available in v4 but will be removed in v5. Consider using FloatButton.BackTop in v5.',
    autoFixable: false,
    guide: 'https://ant.design/components/back-top',
    migrationGuide: `BackTop works in v4 but is deprecated in v5.
Start migrating to FloatButton.BackTop when moving to v5.`,
  },

  // Button.Group - Still exists in v4
  {
    component: 'Button.Group',
    breaking: false,
    description: 'Button.Group still exists in v4 but will be deprecated in v5. Use Space or Space.Compact instead.',
    autoFixable: false,
    migrationGuide: `v4: Button.Group works but start migrating to Space for consistency.
v5: Button.Group removed, use Space.Compact instead.`,
  },

  // Input.Group
  {
    component: 'Input.Group',
    breaking: false,
    description: 'Input.Group still exists in v4 but will be deprecated in v5. Use Space.Compact instead.',
    autoFixable: false,
    migrationGuide: `v4: Input.Group works but start migrating to Space.Compact.
v5: Input.Group removed, use Space.Compact instead.`,
  },

  // DatePicker
  {
    component: 'DatePicker',
    breaking: true,
    description: 'RangePicker props format changed. `format` should be an array for ranged dates.',
    autoFixable: false,
    searchPattern: `<DatePicker\\.RangePicker[^>]*format=`,
    before: `<DatePicker.RangePicker format="YYYY-MM-DD" />`,
    after: `<DatePicker.RangePicker format={['YYYY-MM-DD', 'YYYY-MM-DD']} />`,
  },
  {
    component: 'DatePicker',
    breaking: true,
    description: 'MonthPicker removed. Use DatePicker picker="month" instead.',
    autoFixable: true,
    codemod: 'v4-component-rename',
    searchPattern: `<DatePicker\\.MonthPicker`,
    before: `<DatePicker.MonthPicker />`,
    after: `<DatePicker picker="month" />`,
  },
  {
    component: 'DatePicker',
    breaking: true,
    description: 'WeekPicker removed. Use DatePicker picker="week" instead.',
    autoFixable: true,
    codemod: 'v4-component-rename',
    searchPattern: `<DatePicker\\.WeekPicker`,
    before: `<DatePicker.WeekPicker />`,
    after: `<DatePicker picker="week" />`,
  },

  // TimePicker
  {
    component: 'TimePicker',
    breaking: false,
    description: 'addon prop moved under popupProps in v4.',
    autoFixable: false,
    before: `<TimePicker addon={() => <Button>OK</Button>} />`,
    after: `<TimePicker popupProps={{ addon: () => <Button>OK</Button> }} />`,
  },

  // Table
  {
    component: 'Table',
    breaking: false,
    description: 'Column render callback signature unchanged. Internal pagination and filtering logic improved.',
    autoFixable: false,
    migrationGuide: `The render callback signature (text, record, index) => {} remains unchanged from v3 to v4.
The main differences are internal improvements to pagination and filtering behavior.`,
  },
  {
    component: 'Table',
    breaking: false,
    description: 'Table pagination now supports responsive layout by default.',
    autoFixable: false,
  },

  // Tree
  {
    component: 'Tree',
    breaking: true,
    description: 'TreeNode export added at Tree.TreeNode. Previously only available as TreeNode direct import.',
    autoFixable: false,
    before: `import { Tree, TreeNode } from 'antd';`,
    after: `import { Tree } from 'antd';
const { TreeNode } = Tree;`,
  },

  // Upload
  {
    component: 'Upload',
    breaking: true,
    description: 'fileList type changed to UploadFile[] with stricter typing.',
    autoFixable: false,
  },
  {
    component: 'Upload',
    breaking: true,
    description: '`transformFile` added for transforming files before upload.',
    autoFixable: false,
  },

  // TreeSelect
  {
    component: 'TreeSelect',
    breaking: true,
    description: '`labelInValue` prop behavior changed. Value now includes halfChecked for tree nodes.',
    autoFixable: false,
  },

  // Progress
  {
    component: 'Progress',
    breaking: false,
    description: '`strokeWidth` now defaults to 10px for line type (was 6px in v3).',
    autoFixable: false,
  },

  // Select
  {
    component: 'Select',
    breaking: true,
    description: '`onChange` callback signature changed: now receives option as second param.',
    autoFixable: false,
    before: `onChange={(value) => {}`,
    after: `onChange={(value, option) => {}`,
  },

  // Tooltip/Popover/Popconfirm alignment
  {
    component: 'Tooltip',
    breaking: true,
    description: 'Default `align` prop changed. Adjustments may be needed for precise positioning.',
    autoFixable: false,
  },

  // Alert
  {
    component: 'Alert',
    breaking: false,
    description: '`banner` mode now automatically applies proper styles for closable Alerts.',
    autoFixable: false,
  },

  // Affix
  {
    component: 'Affix',
    breaking: true,
    description: 'offsetTop behavior changed to account for scroll containers correctly.',
    autoFixable: false,
    guide: 'https://ant.design/components/affix',
  },

  // Less
  {
    component: 'Global',
    breaking: false,
    description: 'Less variable naming standardized. Some internal variables renamed.',
    autoFixable: false,
    guide: 'https://ant.design/docs/react/customize-theme',
    migrationGuide: `Most Less variables remain compatible.
Check your theme customizations for any renamed variables.`,
  },

  // Locale
  {
    component: 'Global',
    breaking: false,
    description: 'Locale files restructured. Some locale keys changed.',
    autoFixable: false,
    migrationGuide: `If using custom locale files, verify keys match v4 structure.
Default locales are bundled correctly.`,
  },

  // ConfigProvider
  {
    component: 'ConfigProvider',
    breaking: false,
    description: 'ConfigProvider is introduced in v4 to replace LocaleProvider for global configuration.',
    autoFixable: false,
    migrationGuide: `v3: Use LocaleProvider for locale configuration
v4: Use ConfigProvider for all global configuration (locale, prefixCls, etc.)
ConfigProvider replaces LocaleProvider with enhanced capabilities.`,
    before: `import { LocaleProvider } from 'antd';
<LocaleProvider locale={enUS}>`,
    after: `import { ConfigProvider } from 'antd';
<ConfigProvider locale={enUS}>`,
  },
];