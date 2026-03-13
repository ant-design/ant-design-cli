import type { MigrationStep } from './migrate.js';

export const V5_TO_V6_STEPS: MigrationStep[] = [
  // ─── Global / Environment ───────────────────────────────────────────────────

  {
    component: 'Global',
    breaking: true,
    description: 'React >= 18 required. React 17 and earlier are no longer supported.',
    autoFixable: false,
    migrationGuide: `1. Upgrade React to 18 or above
2. Remove @ant-design/v5-patch-for-react-19 if present (no longer needed)`,
    searchPattern: `@ant-design/v5-patch-for-react-19`,
    before: `import '@ant-design/v5-patch-for-react-19';`,
    after: `// Remove this import — no longer needed in v6`,
  },
  {
    component: 'Global',
    breaking: true,
    description: '@ant-design/icons must be upgraded to v6. Icons v6 is not compatible with antd v5.',
    autoFixable: false,
    migrationGuide: `1. Run: npm install @ant-design/icons@6
2. @ant-design/icons@6 is NOT compatible with antd@5 — upgrade both together
3. If build errors occur, verify icon package version matches antd version`,
  },
  {
    component: 'Global',
    breaking: true,
    description: 'CSS variables enabled by default. Only modern browsers supported, IE is not supported.',
    autoFixable: false,
    migrationGuide: `Verify your target browsers support CSS variables. IE and some older domestic browsers may have issues.`,
  },
  {
    component: 'Global',
    breaking: false,
    description: 'DOM structure of many components optimized. Custom styles targeting internal DOM nodes may need adjustment.',
    autoFixable: false,
    migrationGuide: `If your project has CSS that targets component internal DOM nodes (specific selectors or hierarchy), inspect and adjust after upgrading.`,
  },

  // ─── Button ─────────────────────────────────────────────────────────────────

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
  {
    component: 'Button',
    breaking: false,
    description: '`iconPosition` deprecated, use `iconPlacement` instead.',
    autoFixable: true,
    codemod: 'v6-props-changed-migration',
    searchPattern: `<Button[^>]*\\biconPosition\\b`,
    before: `<Button iconPosition="end">Click</Button>`,
    after: `<Button iconPlacement="end">Click</Button>`,
  },
  {
    component: 'Button.Group',
    breaking: false,
    description: '`Button.Group` deprecated, use `Space.Compact` instead.',
    autoFixable: false,
    searchPattern: `Button\\.Group`,
    before: `<Button.Group><Button>A</Button><Button>B</Button></Button.Group>`,
    after: `<Space.Compact><Button>A</Button><Button>B</Button></Space.Compact>`,
  },

  // ─── Alert ──────────────────────────────────────────────────────────────────

  {
    component: 'Alert',
    breaking: false,
    description: '`closeText` deprecated → `closable.closeIcon`; `message` deprecated → `title`.',
    autoFixable: false,
    searchPattern: `<Alert[^>]*\\b(closeText|message)\\s*=`,
    migrationGuide: `- closeText="Close" → closable={{ closeIcon: "Close" }}
- message="Title" → title="Title"`,
  },

  // ─── Anchor ─────────────────────────────────────────────────────────────────

  {
    component: 'Anchor',
    breaking: false,
    description: '`Anchor` children usage deprecated, use `items` prop instead.',
    autoFixable: false,
    searchPattern: `<Anchor>\\s*<Anchor\\.Link`,
    migrationGuide: `Replace Anchor children with items prop array.`,
  },

  // ─── AutoComplete ───────────────────────────────────────────────────────────

  {
    component: 'AutoComplete',
    breaking: false,
    description: 'Multiple deprecated props: `dropdownMatchSelectWidth` → `popupMatchSelectWidth`, `dropdownClassName` → `classNames.popup.root`, `dropdownRender` → `popupRender`, `dataSource` → `options`.',
    autoFixable: false,
    searchPattern: `<AutoComplete[^>]*\\b(dropdownMatchSelectWidth|dropdownClassName|dropdownStyle|dropdownRender|onDropdownVisibleChange|dataSource)\\b`,
    migrationGuide: `- dropdownMatchSelectWidth → popupMatchSelectWidth
- dropdownClassName / popupClassName → classNames.popup.root
- dropdownStyle → styles.popup.root
- dropdownRender → popupRender
- onDropdownVisibleChange → onOpenChange
- dataSource → options`,
  },

  // ─── Avatar.Group ───────────────────────────────────────────────────────────

  {
    component: 'Avatar.Group',
    breaking: false,
    description: '`maxCount`/`maxStyle`/`maxPopoverPlacement`/`maxPopoverTrigger` deprecated, use `max` prop object.',
    autoFixable: false,
    searchPattern: `<Avatar\\.Group[^>]*\\b(maxCount|maxStyle|maxPopoverPlacement|maxPopoverTrigger)\\b`,
    before: `<Avatar.Group maxCount={3} maxStyle={{ color: 'red' }}>`,
    after: `<Avatar.Group max={{ count: 3, style: { color: 'red' } }}>`,
  },

  // ─── Breadcrumb ─────────────────────────────────────────────────────────────

  {
    component: 'Breadcrumb',
    breaking: false,
    description: '`routes` deprecated → `items`; `Breadcrumb.Item` / `Breadcrumb.Separator` deprecated → `items`.',
    autoFixable: false,
    searchPattern: `(Breadcrumb\\.Item|Breadcrumb\\.Separator|<Breadcrumb[^>]*\\broutes\\b)`,
    migrationGuide: `Replace Breadcrumb children or routes prop with items array.`,
  },

  // ─── Calendar ───────────────────────────────────────────────────────────────

  {
    component: 'Calendar',
    breaking: false,
    description: '`dateFullCellRender`/`dateCellRender`/`monthFullCellRender`/`monthCellRender` deprecated → `fullCellRender`/`cellRender`.',
    autoFixable: false,
    searchPattern: `<Calendar[^>]*\\b(dateFullCellRender|dateCellRender|monthFullCellRender|monthCellRender)\\b`,
  },

  // ─── Card ───────────────────────────────────────────────────────────────────

  {
    component: 'Card',
    breaking: false,
    description: '`headStyle` → `styles.header`; `bodyStyle` → `styles.body`; `bordered` → `variant`.',
    autoFixable: false,
    searchPattern: `<Card[^>]*\\b(headStyle|bodyStyle|bordered)\\b`,
    migrationGuide: `- headStyle → styles.header
- bodyStyle → styles.body
- bordered={false} → variant="borderless"`,
  },

  // ─── Cascader ───────────────────────────────────────────────────────────────

  {
    component: 'Cascader',
    breaking: false,
    description: 'Multiple deprecated props: `dropdownClassName` → `classNames.popup.root`, `bordered` → `variant`, `onPopupVisibleChange` → `onOpenChange`.',
    autoFixable: false,
    searchPattern: `<Cascader[^>]*\\b(dropdownClassName|dropdownStyle|dropdownRender|dropdownMenuColumnStyle|onDropdownVisibleChange|onPopupVisibleChange|bordered)\\b`,
  },

  // ─── Collapse ───────────────────────────────────────────────────────────────

  {
    component: 'Collapse',
    breaking: false,
    description: '`destroyInactivePanel` → `destroyOnHidden`; `expandIconPosition` → `expandIconPlacement`.',
    autoFixable: false,
    searchPattern: `<Collapse[^>]*\\b(destroyInactivePanel|expandIconPosition)\\b`,
  },

  // ─── DatePicker ─────────────────────────────────────────────────────────────

  {
    component: 'DatePicker',
    breaking: false,
    description: 'Multiple deprecated props: `popupClassName` → `classNames.popup.root`, `bordered` → `variant`, `onSelect` → `onCalendarChange`.',
    autoFixable: false,
    searchPattern: `<(DatePicker|RangePicker)[^>]*\\b(dropdownClassName|popupClassName|popupStyle|bordered|onSelect)\\b`,
  },

  // ─── Descriptions ──────────────────────────────────────────────────────────

  {
    component: 'Descriptions',
    breaking: false,
    description: '`labelStyle` → `styles.label`; `contentStyle` → `styles.content`.',
    autoFixable: false,
    searchPattern: `<Descriptions[^>]*\\b(labelStyle|contentStyle)\\b`,
  },

  // ─── Divider ────────────────────────────────────────────────────────────────

  {
    component: 'Divider',
    breaking: false,
    description: '`type` deprecated → `orientation`; `orientationMargin` → `styles.content.margin`.',
    autoFixable: false,
    searchPattern: `<Divider[^>]*\\b(type\\s*=|orientationMargin)\\b`,
  },

  // ─── Drawer ─────────────────────────────────────────────────────────────────

  {
    component: 'Drawer',
    breaking: false,
    description: 'Style props deprecated: `headerStyle`/`bodyStyle`/`footerStyle`/`maskStyle`/`drawerStyle`/`contentWrapperStyle` → `styles.*`; `width`/`height` → `size`; `destroyInactivePanel` → `destroyOnHidden`.',
    autoFixable: false,
    searchPattern: `<Drawer[^>]*\\b(headerStyle|bodyStyle|footerStyle|contentWrapperStyle|maskStyle|drawerStyle|destroyInactivePanel)\\b`,
    migrationGuide: `- headerStyle → styles.header
- bodyStyle → styles.body
- footerStyle → styles.footer
- contentWrapperStyle → styles.wrapper
- maskStyle → styles.mask
- drawerStyle → styles.section
- width/height → size
- destroyInactivePanel → destroyOnHidden`,
  },

  // ─── Dropdown ───────────────────────────────────────────────────────────────

  {
    component: 'Dropdown',
    breaking: false,
    description: '`overlayClassName` → `classNames.root`; `overlayStyle` → `styles.root`; `destroyPopupOnHide` → `destroyOnHidden`. `Dropdown.Button` deprecated → `Space.Compact + Dropdown + Button`.',
    autoFixable: false,
    searchPattern: `(Dropdown\\.Button|<Dropdown[^>]*\\b(overlayClassName|overlayStyle|destroyPopupOnHide|dropdownRender)\\b)`,
  },

  // ─── Form ───────────────────────────────────────────────────────────────────

  {
    component: 'Form',
    breaking: true,
    description: '`onFinish` no longer includes all Form.List data. Unregistered Form.Item fields are excluded.',
    autoFixable: false,
    migrationGuide: `In v5, Form.List was treated as a single Field, causing onFinish to include all data.
In v6, only registered Form.Item fields are included.
You no longer need getFieldsValue({ strict: true }) to filter.`,
    before: `const onFinish = (values) => {
  const realValues = getFieldsValue({ strict: true });
};`,
    after: `const onFinish = (values) => {
  const realValues = values; // Already filtered in v6
};`,
  },

  // ─── Image ──────────────────────────────────────────────────────────────────

  {
    component: 'Image',
    breaking: false,
    description: '`visible` → `open`; `onVisibleChange` → `onOpenChange`; `wrapperStyle` → `styles.root`; `maskClassName` → `classNames.cover`; `toolbarRender` → `actionsRender`.',
    autoFixable: false,
    searchPattern: `<Image[^>]*\\b(visible|onVisibleChange|wrapperStyle|maskClassName|rootClassName|toolbarRender)\\b`,
  },

  // ─── Input.Group ────────────────────────────────────────────────────────────

  {
    component: 'Input.Group',
    breaking: false,
    description: '`Input.Group` deprecated, use `Space.Compact` instead.',
    autoFixable: false,
    searchPattern: `Input\\.Group`,
    before: `<Input.Group compact><Input /><Input /></Input.Group>`,
    after: `<Space.Compact><Input /><Input /></Space.Compact>`,
  },

  // ─── Menu ───────────────────────────────────────────────────────────────────

  {
    component: 'Menu',
    breaking: false,
    description: '`children` deprecated, use `items` prop instead.',
    autoFixable: false,
    searchPattern: `<Menu>\\s*<Menu\\.Item`,
  },

  // ─── Modal ──────────────────────────────────────────────────────────────────

  {
    component: 'Modal',
    breaking: false,
    description: '`bodyStyle` → `styles.body`; `maskStyle` → `styles.mask`; `destroyOnClose` → `destroyOnHidden`.',
    autoFixable: false,
    searchPattern: `<Modal[^>]*\\b(bodyStyle|maskStyle|destroyOnClose)\\b`,
  },

  // ─── Notification ──────────────────────────────────────────────────────────

  {
    component: 'notification',
    breaking: false,
    description: '`btn` deprecated → `actions`; `message` deprecated → `title`.',
    autoFixable: false,
    searchPattern: `notification\\.(open|success|error|info|warning)\\(\\{[^}]*(\\bbtn\\b|\\bmessage\\b)`,
  },

  // ─── Progress ───────────────────────────────────────────────────────────────

  {
    component: 'Progress',
    breaking: false,
    description: '`strokeWidth`/`width` → `size`; `trailColor` → `railColor`; `gapPosition` → `gapPlacement`.',
    autoFixable: false,
    searchPattern: `<Progress[^>]*\\b(strokeWidth|trailColor|gapPosition)\\b`,
  },

  // ─── Select ─────────────────────────────────────────────────────────────────

  {
    component: 'Select',
    breaking: false,
    description: 'Multiple deprecated props: `dropdownClassName` → `classNames.popup.root`, `dropdownRender` → `popupRender`, `bordered` → `variant`, `onDropdownVisibleChange` → `onOpenChange`.',
    autoFixable: false,
    searchPattern: `<Select[^>]*\\b(dropdownClassName|dropdownStyle|dropdownRender|onDropdownVisibleChange|bordered)\\b`,
  },

  // ─── Slider ─────────────────────────────────────────────────────────────────

  {
    component: 'Slider',
    breaking: false,
    description: 'Tooltip props deprecated: `tooltipPrefixCls` → `tooltip.prefixCls`, `tipFormatter` → `tooltip.formatter`, `tooltipVisible` → `tooltip.open`, `tooltipPlacement` → `tooltip.placement`.',
    autoFixable: false,
    searchPattern: `<Slider[^>]*\\b(tooltipPrefixCls|tipFormatter|tooltipVisible|tooltipPlacement|getTooltipPopupContainer)\\b`,
  },

  // ─── Space ──────────────────────────────────────────────────────────────────

  {
    component: 'Space',
    breaking: false,
    description: '`direction` → `orientation`; `split` → `separator`.',
    autoFixable: false,
    searchPattern: `<Space[^>]*\\b(direction|split)\\s*=`,
  },

  // ─── Steps ──────────────────────────────────────────────────────────────────

  {
    component: 'Steps',
    breaking: false,
    description: '`labelPlacement` → `titlePlacement`; `progressDot` → `type="dot"`; `direction` → `orientation`; `items.description` → `items.content`.',
    autoFixable: false,
    searchPattern: `<Steps[^>]*\\b(labelPlacement|progressDot|direction)\\b`,
  },

  // ─── Table ──────────────────────────────────────────────────────────────────

  {
    component: 'Table',
    breaking: false,
    description: '`pagination.position` → `pagination.placement`; `filterDropdownOpen` → `filterDropdownProps.open`; `onFilterDropdownOpenChange` → `filterDropdownProps.onOpenChange`.',
    autoFixable: false,
    searchPattern: `(filterDropdownOpen|onFilterDropdownOpenChange|filterCheckall)`,
  },

  // ─── Tabs ───────────────────────────────────────────────────────────────────

  {
    component: 'Tabs',
    breaking: false,
    description: '`tabPosition` → `tabPlacement`; `destroyInactiveTabPane` → `destroyOnHidden`; `Tabs.TabPane` deprecated → `items`.',
    autoFixable: false,
    searchPattern: `(Tabs\\.TabPane|<Tabs[^>]*\\b(tabPosition|destroyInactiveTabPane)\\b)`,
  },

  // ─── Tag ────────────────────────────────────────────────────────────────────

  {
    component: 'Tag',
    breaking: true,
    description: 'Default trailing margin removed. `bordered={false}` → `variant="filled"`; `color="xxx-inverse"` → `variant="solid"`.',
    autoFixable: false,
    searchPattern: `<Tag[^>]*\\b(bordered|color\\s*=\\s*['"][^'"]*-inverse)`,
    migrationGuide: `- Tag trailing margin removed. Add margin via ConfigProvider tag.styles if needed.
- bordered={false} → variant="filled"
- color="xxx-inverse" → variant="solid"`,
  },

  // ─── Timeline ───────────────────────────────────────────────────────────────

  {
    component: 'Timeline',
    breaking: false,
    description: '`Timeline.Item` deprecated → `items`; `pending`/`pendingDot` deprecated → `items`; `mode=left|right` → `mode=start|end`.',
    autoFixable: false,
    searchPattern: `(Timeline\\.Item|<Timeline[^>]*\\b(pending|pendingDot|mode\\s*=\\s*['"](?:left|right))\\b)`,
  },

  // ─── Tooltip ────────────────────────────────────────────────────────────────

  {
    component: 'Tooltip',
    breaking: false,
    description: '`overlayStyle` → `styles.root`; `overlayInnerStyle` → `styles.container`; `overlayClassName` → `classNames.root`; `destroyTooltipOnHide` → `destroyOnHidden`.',
    autoFixable: false,
    searchPattern: `<Tooltip[^>]*\\b(overlayStyle|overlayInnerStyle|overlayClassName|destroyTooltipOnHide)\\b`,
  },

  // ─── Transfer ───────────────────────────────────────────────────────────────

  {
    component: 'Transfer',
    breaking: false,
    description: '`listStyle` → `styles.section`; `operationStyle` → `styles.actions`; `operations` → `actions`.',
    autoFixable: false,
    searchPattern: `<Transfer[^>]*\\b(listStyle|operationStyle|operations)\\b`,
  },

  // ─── TreeSelect ─────────────────────────────────────────────────────────────

  {
    component: 'TreeSelect',
    breaking: false,
    description: 'Multiple deprecated props: `dropdownClassName` → `classNames.popup.root`, `dropdownRender` → `popupRender`, `bordered` → `variant`, `onDropdownVisibleChange` → `onOpenChange`.',
    autoFixable: false,
    searchPattern: `<TreeSelect[^>]*\\b(dropdownClassName|dropdownStyle|dropdownRender|onDropdownVisibleChange|bordered)\\b`,
  },

  // ─── Overlay: Modal, Drawer mask blur ──────────────────────────────────────

  {
    component: 'Global',
    breaking: false,
    description: 'Modal/Drawer mask blur enabled by default. Disable via ConfigProvider if undesired.',
    autoFixable: false,
    migrationGuide: `If you don't want the mask blur effect:
<ConfigProvider modal={{ mask: { blur: false } }} drawer={{ mask: { blur: false } }}>
  <App />
</ConfigProvider>`,
  },
];
