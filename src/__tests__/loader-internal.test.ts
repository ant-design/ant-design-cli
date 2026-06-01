/**
 * Direct tests for parsePropsFromDoc and backfillFromMajor.
 *
 * These test the internal parsing/backfill functions with realistic antd-style
 * markdown docs, exercising code paths that bundled snapshot data cannot reach.
 * The functions are exported for testing but are not part of the public CLI API.
 */
import { describe, it, expect } from 'vitest';
import { parsePropsFromDoc, backfillFromMajor } from '../data/loader.js';
import type { ComponentData, MetadataStore } from '../types.js';

/** Helper to create a minimal ComponentData with doc */
function withDoc(name: string, doc: string, docZh?: string): ComponentData {
  return { name, category: 'test', description: '', props: [], doc, docZh } as ComponentData;
}

describe('parsePropsFromDoc', () => {
  it('returns null when component has no doc', () => {
    expect(parsePropsFromDoc({ name: 'X', category: 'test', description: '', props: [] } as ComponentData)).toBeNull();
  });

  it('returns null when doc has no ## API section', () => {
    expect(parsePropsFromDoc(withDoc('X', '## Usage\n\nSome notes.'))).toBeNull();
  });

  it('returns null when API section has no tables', () => {
    expect(parsePropsFromDoc(withDoc('X', '## API\n\nThis section has no tables, just prose text.\n\n## Design Token\n\nTokens here.'))).toBeNull();
  });

  it('parses main props from flat API table', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| visible | Whether visible | boolean | false |
| size | Size | string | middle |`));

    expect(result).not.toBeNull();
    expect(result!.props.length).toBe(2);
    expect(result!.props[0].name).toBe('visible');
    expect(result!.props[0].description).toBe('Whether visible');
    expect(result!.props[1].name).toBe('size');
    expect(Object.keys(result!.subComponentProps).length).toBe(0);
  });

  it('parses Chinese descriptions from docZh', () => {
    const result = parsePropsFromDoc(withDoc('Widget',
      `## API\n\n| Property | Description | Type | Default |\n| --- | --- | --- | --- |\n| visible | Whether visible | boolean | false |`,
      `## API\n\n| 参数 | 说明 | 类型 | 默认值 |\n| --- | --- | --- | --- |\n| visible | 是否可见 | boolean | false |`,
    ));

    expect(result).not.toBeNull();
    expect(result!.props[0].descriptionZh).toBe('是否可见');
  });

  it('parses Version column into since field', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Property | Description | Type | Default | Version |
| --- | --- | --- | --- | --- |
| newProp | New prop | string | - | 5.2.0 |
| oldProp | Old prop | number | 0 | |`));

    expect(result).not.toBeNull();
    expect(result!.props.find(p => p.name === 'newProp')!.since).toBe('5.2.0');
    expect(result!.props.find(p => p.name === 'oldProp')!.since).toBeFalsy();
  });

  it('parses 版本 (Chinese version) column', () => {
    const result = parsePropsFromDoc(withDoc('Widget',
      `## API\n\n| Property | Description | Type | Default |\n| --- | --- | --- | --- |\n| foo | bar | string | - |`,
      `## API\n\n| 参数 | 说明 | 类型 | 默认值 | 版本 |\n| --- | --- | --- | --- | --- |\n| foo | 中文 | string | - | 4.18.0 |`,
    ));

    expect(result).not.toBeNull();
    expect(result!.props[0].descriptionZh).toBe('中文');
  });

  it('parses deprecated (strikethrough) props', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| ~~oldProp~~ | Deprecated | string | - |
| newProp | Current | number | 0 |`));

    expect(result).not.toBeNull();
    const old = result!.props.find(p => p.name === 'oldProp');
    expect(old).toBeDefined();
    expect(old!.deprecated).toBe(true);
    expect(result!.props.find(p => p.name === 'newProp')!.deprecated).toBeFalsy();
  });

  it('recognizes Props column header (Drawer-style)', () => {
    const result = parsePropsFromDoc(withDoc('Drawer', `## API

| Props | Description | Type | Default |
| --- | --- | --- | --- |
| open | Whether open | boolean | false |`));

    expect(result).not.toBeNull();
    expect(result!.props[0].name).toBe('open');
  });

  it('recognizes Argument column header', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Argument | Description | Type | Default |
| --- | --- | --- | --- |
| callback | Callback fn | function | - |`));

    expect(result).not.toBeNull();
    expect(result!.props[0].name).toBe('callback');
  });

  it('falls back to first column for unknown header', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Field | Description | Type | Default |
| --- | --- | --- | --- |
| alpha | First field | string | - |`));

    expect(result).not.toBeNull();
    expect(result!.props[0].name).toBe('alpha');
  });

  it('skips tables with fewer than 3 lines', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |`));

    expect(result).toBeNull();
  });

  it('stops at terminal sections (## Note)', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| visible | Whether visible | boolean | false |

## Note

| Column | Value |
| --- | --- |
| note1 | Should NOT be parsed |`));

    expect(result).not.toBeNull();
    expect(result!.props.length).toBe(1);
    expect(result!.props[0].name).toBe('visible');
  });

  it('stops at Design Token terminal section', () => {
    const result = parsePropsFromDoc(withDoc('Widget', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| color | Token color | string | blue |

## Design Token

| Token | Value |
| --- | --- |
| --widget-color | #1890ff |`));

    expect(result).not.toBeNull();
    expect(result!.props.length).toBe(1);
  });

  it('separates sub-component ### sections: slash format is main', () => {
    const result = parsePropsFromDoc(withDoc('Radio', `## API

### Radio/Radio.Button

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| checked | Whether checked | boolean | false |

### Radio.Group

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| size | Size | string | - |`));

    expect(result).not.toBeNull();
    expect(result!.props.some(p => p.name === 'checked')).toBe(true);
    expect(result!.subComponentProps['Radio.Group']).toBeDefined();
    expect(result!.subComponentProps['Radio.Group'].some(p => p.name === 'size')).toBe(true);
  });

  it('uses dot-prefixed label as-is for subComponentProps', () => {
    const result = parsePropsFromDoc(withDoc('ConfigProvider', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| locale | Locale | object | - |

### ConfigProvider.useConfig()

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| componentConfig | Config | object | - |`));

    expect(result).not.toBeNull();
    expect(result!.props.some(p => p.name === 'locale')).toBe(true);
    const keys = Object.keys(result!.subComponentProps);
    expect(keys.some(k => k.includes('useConfig'))).toBe(true);
  });

  it('prepends component name to non-dotted sub-section labels', () => {
    const result = parsePropsFromDoc(withDoc('Wizard', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| active | Active step | number | 0 |

### Step

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| title | Step title | string | - |`));

    expect(result).not.toBeNull();
    expect(result!.props.some(p => p.name === 'active')).toBe(true);
    expect(result!.subComponentProps['Wizard.Step']).toBeDefined();
  });

  it('recognizes "common API" as main section', () => {
    const result = parsePropsFromDoc(withDoc('FloatButton', `## API

### common API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| type | Button type | string | default |`));

    expect(result).not.toBeNull();
    expect(result!.props.some(p => p.name === 'type')).toBe(true);
    expect(Object.keys(result!.subComponentProps).length).toBe(0);
  });

  it('recognizes prefix match (Tree props for TreeSelect)', () => {
    const result = parsePropsFromDoc(withDoc('TreeSelect', `## API

### Tree props

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| treeData | Tree data | array | - |

### TreeSelect props

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| value | Selected value | string | - |`));

    expect(result).not.toBeNull();
    expect(result!.props.some(p => p.name === 'treeData')).toBe(true);
    expect(result!.props.some(p => p.name === 'value')).toBe(true);
  });

  it('recognizes singular/plural name (Mention for Mentions)', () => {
    const result = parsePropsFromDoc(withDoc('Mentions', `## API

### Mention

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| prefix | Prefix char | string | @ |`));

    expect(result).not.toBeNull();
    expect(result!.props.some(p => p.name === 'prefix')).toBe(true);
  });

  it('strips Badge text and anchors from headings via cleanLabel', () => {
    const result = parsePropsFromDoc(withDoc('Avatar', `## API

### Avatar.Group <Badge>4.5.0+</Badge>

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| gap | Gap | number | - |

### Avatar {#avatar-anchor}

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| shape | Shape | string | circle |`));

    expect(result).not.toBeNull();
    // "Avatar.Group" (after Badge stripped) is not a slash format, so it's a sub-component.
    // "Avatar" (after anchor stripped) matches the component name exactly, so it's main.
    expect(result!.props.some(p => p.name === 'shape')).toBe(true);
    expect(result!.subComponentProps).toBeDefined();
    // "Avatar.Group" goes to subComponentProps since it doesn't match any isMainSection rule
    expect(Object.keys(result!.subComponentProps).some(k => k.includes('Avatar.Group'))).toBe(true);
  });

  it('handles h2 sub-sections as non-main subComponentProps', () => {
    const result = parsePropsFromDoc(withDoc('DatePicker', `## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| value | Current value | Dayjs | - |

## Methods

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| focus | Focus input | () => void | - |`));

    expect(result).not.toBeNull();
    expect(result!.props.some(p => p.name === 'value')).toBe(true);
    expect(result!.subComponentProps['DatePicker.Methods']).toBeDefined();
  });
});

describe('backfillFromMajor', () => {
  it('copies props and subComponentProps from major version', () => {
    const comp: ComponentData = { name: 'TestComp', category: 'test', description: '', props: [] };
    const majorStore: MetadataStore = {
      version: '5', majorVersion: 'v5',
      components: [{
        name: 'TestComp', category: 'test', description: 'Test', descriptionZh: '测试',
        props: [{ name: 'alpha', type: 'string', default: '-' }],
        subComponentProps: { 'TestComp.Sub': [{ name: 'beta', type: 'number', default: '0' }] },
      }],
    };

    backfillFromMajor(comp, majorStore);
    expect(comp.props.length).toBe(1);
    expect(comp.props[0].name).toBe('alpha');
    expect(comp.description).toBe('Test');
    expect(comp.descriptionZh).toBe('测试');
    expect(comp.subComponentProps).toBeDefined();
    expect('TestComp.Sub' in comp.subComponentProps!).toBe(true);
    // Shallow copy: arrays are independent
    expect(comp.subComponentProps!['TestComp.Sub']).not.toBe(
      majorStore.components[0].subComponentProps!['TestComp.Sub'],
    );
  });

  it('does not overwrite existing props', () => {
    const comp: ComponentData = {
      name: 'TestComp', category: 'test', description: '',
      props: [{ name: 'existing', type: 'string', default: '-' }],
    };
    const majorStore: MetadataStore = {
      version: '5', majorVersion: 'v5',
      components: [{ name: 'TestComp', category: 'test', description: 'Major', props: [{ name: 'alpha', type: 'string', default: '-' }] }],
    };

    backfillFromMajor(comp, majorStore);
    expect(comp.props.length).toBe(1);
    expect(comp.props[0].name).toBe('existing');
    expect(comp.description).toBe('Major'); // description backfilled
  });

  it('does not overwrite existing description or descriptionZh', () => {
    const comp: ComponentData = {
      name: 'TestComp', category: 'test',
      description: 'Existing', descriptionZh: '现有',
      props: [],
    };
    const majorStore: MetadataStore = {
      version: '5', majorVersion: 'v5',
      components: [{ name: 'TestComp', category: 'test', description: 'Major', descriptionZh: '主要', props: [{ name: 'x', type: 'string', default: '-' }] }],
    };

    backfillFromMajor(comp, majorStore);
    expect(comp.description).toBe('Existing');
    expect(comp.descriptionZh).toBe('现有');
  });

  it('backfills descriptionZh independently when description exists', () => {
    const comp: ComponentData = {
      name: 'TestComp', category: 'test',
      description: 'Existing', descriptionZh: '',
      props: [{ name: 'x', type: 'string', default: '-' }],
    };
    const majorStore: MetadataStore = {
      version: '5', majorVersion: 'v5',
      components: [{ name: 'TestComp', category: 'test', description: 'Major', descriptionZh: '主要', props: [] }],
    };

    backfillFromMajor(comp, majorStore);
    expect(comp.description).toBe('Existing');
    expect(comp.descriptionZh).toBe('主要');
  });

  it('does nothing when major store has no matching component', () => {
    const comp: ComponentData = { name: 'Nonexistent', category: 'test', description: '', props: [] };
    const majorStore: MetadataStore = {
      version: '5', majorVersion: 'v5',
      components: [{ name: 'Other', category: 'test', description: 'Other', props: [{ name: 'x', type: 'string', default: '-' }] }],
    };

    backfillFromMajor(comp, majorStore);
    expect(comp.props.length).toBe(0);
    expect(comp.description).toBe('');
  });
});