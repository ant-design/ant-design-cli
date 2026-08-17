import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { extractProps, parseTableRow } from '../props.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('parseTableRow', () => {
  it('handles normal rows', () => {
    const cells = parseTableRow('| foo | bar | baz |');
    expect(cells).toEqual(['foo', 'bar', 'baz']);
  });

  it('handles escaped pipes in type values', () => {
    const cells = parseTableRow(
      '| color | Set color | `default` \\| `primary` \\| `danger` | `default` | 5.21.0 |',
    );
    expect(cells).toEqual([
      'color',
      'Set color',
      '`default` | `primary` | `danger`',
      '`default`',
      '5.21.0',
    ]);
  });

  it('handles multiple escaped pipes in a single cell', () => {
    const cells = parseTableRow('| type | desc | `a` \\| `b` \\| `c` | - |  |');
    expect(cells[2]).toBe('`a` | `b` | `c`');
    expect(cells[3]).toBe('-');
  });

  it('handles rows without escaped pipes (no regression)', () => {
    const cells = parseTableRow('| disabled | Whether disabled | boolean | false |  |');
    expect(cells).toEqual(['disabled', 'Whether disabled', 'boolean', 'false', '']);
  });

  it('cleans up escaped brackets from markdown', () => {
    const cells = parseTableRow('| options | Options | string\\[] | - |  |');
    expect(cells[2]).toBe('string[]');
  });

  it('cleans up escaped angle brackets from markdown', () => {
    const cells = parseTableRow('| render | Render | (item: T) \\<ReactNode> | - |  |');
    expect(cells[2]).toBe('(item: T) <ReactNode>');
  });

  it('cleans up multiple escape types in one cell', () => {
    const cells = parseTableRow('| items | Items | \\[ItemType\\[]](#itemtype) | - |  |');
    expect(cells[2]).toBe('[ItemType[]](#itemtype)');
  });

  it('handles escaped brackets in default values', () => {
    const cells = parseTableRow('| defaultValue | Default | string\\[] | \\[] |  |');
    expect(cells[2]).toBe('string[]');
    expect(cells[3]).toBe('[]');
  });

  it('decodes HTML entities in type values', () => {
    const cells = parseTableRow('| render | Render | React.ReactElement&lt;InputProps> | - |  |');
    expect(cells[2]).toBe('React.ReactElement<InputProps>');
  });

  it('decodes HTML entities in default values', () => {
    const cells = parseTableRow('| icon | Icon | ReactNode | &lt;Input /&gt; |  |');
    expect(cells[3]).toBe('<Input />');
  });

  it('decodes &amp; entity', () => {
    const cells = parseTableRow('| key | Key | string &amp; number | - |  |');
    expect(cells[2]).toBe('string & number');
  });

  it('handles mixed HTML entities and escaped brackets', () => {
    const cells = parseTableRow('| items | Items | Array&lt;{key: string}&gt;\\[] | - |  |');
    expect(cells[2]).toBe('Array<{key: string}>[]');
  });
});

describe('extractProps', () => {
  it('expands common props, fills missing fields, and preserves specific duplicates', () => {
    const antdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antd-cli-props-'));
    tempDirs.push(antdDir);

    const tooltipDir = path.join(antdDir, 'components', 'tooltip');
    const sharedDir = path.join(tooltipDir, 'shared');
    const nestedDir = path.join(sharedDir, 'nested');
    fs.mkdirSync(nestedDir, { recursive: true });

    fs.writeFileSync(path.join(tooltipDir, 'index.en-US.md'), `---
title: Tooltip
---

## API

| Property | Description | Type | Default value | Version |
| --- | --- | --- | --- | --- |
| title | Tooltip title | ReactNode | - | 5.0.0 |
| active | Component active | boolean | | 6.0.0 |
| width | Set title width | number \\| string | - | |
| width | Set paragraph width | number \\| string \\| Array<number \\| string> | - | |

### Common API

<embed src="./shared/sharedProps.en-US.md"></embed>

### ItemType

#### MenuItem

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| disabled | Whether the menu item is disabled | boolean | false |

#### SubMenu

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| disabled | Whether the sub-menu is disabled | boolean | false |
`);
    fs.writeFileSync(path.join(tooltipDir, 'index.zh-CN.md'), `---
title: Tooltip
---

## API

| 参数 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| title | 提示文字 | ReactNode | - | 5.0.0 |
| width | 设置标题占位图的宽度 | number \| string | - | |
| width | 设置段落占位图的宽度 | number \| string \| Array<number \| string> | - | |

### 共同的 API

<embed src="./shared/sharedProps.zh-CN.md"></embed>

### ItemType

#### MenuItem

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| disabled | 菜单项是否禁用 | boolean | false |

#### SubMenu

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| disabled | 子菜单是否禁用 | boolean | false |
`);
    fs.writeFileSync(path.join(sharedDir, 'sharedProps.en-US.md'), `| Property | Description | Type | Default | Version |
| --- | --- | --- | --- | --- |
| title | Shared title | ReactNode | - | 4.0.0 |
| active | Shared active | boolean | false | 5.0.0 |
| arrow | Show the arrow | boolean | true | 5.2.0 |
| open | Whether the popup is open | boolean | false | - |

<embed src="./nested/nestedProps.en-US.md"></embed>
`);
    fs.writeFileSync(path.join(sharedDir, 'sharedProps.zh-CN.md'), `| 参数 | 说明 | 类型 | 默认值 | 版本 |
| --- | --- | --- | --- | --- |
| title | 共享标题 | ReactNode | - | 4.0.0 |
| active | 是否展示动画效果 | boolean | false | 5.0.0 |
| arrow | 是否显示箭头 | boolean | true | 5.2.0 |
| open | 浮层是否打开 | boolean | false | - |

<embed src="./nested/nestedProps.zh-CN.md"></embed>
`);
    fs.writeFileSync(path.join(nestedDir, 'nestedProps.en-US.md'), `| Property | Description | Type | Default |
| --- | --- | --- | --- |
| nested | Nested shared prop | string | - |

<embed src="../sharedProps.en-US.md"></embed>
`);
    fs.writeFileSync(path.join(nestedDir, 'nestedProps.zh-CN.md'), `| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| nested | 嵌套共享属性 | string | - |

<embed src="../sharedProps.zh-CN.md"></embed>
`);

    const result = extractProps(antdDir, 'tooltip', 'Tooltip');

    expect(result.props.map((prop) => prop.name)).toEqual([
      'title',
      'active',
      'width',
      'width',
      'arrow',
      'open',
      'nested',
    ]);
    expect(result.props[0]).toMatchObject({
      description: 'Tooltip title',
      descriptionZh: '提示文字',
      since: '5.0.0',
    });
    expect(result.props[1]).toMatchObject({
      description: 'Component active',
      descriptionZh: '是否展示动画效果',
      default: 'false',
      since: '6.0.0',
    });
    expect(result.props.filter((prop) => prop.name === 'width')).toEqual([
      expect.objectContaining({
        description: 'Set title width',
        descriptionZh: '设置标题占位图的宽度',
      }),
      expect.objectContaining({
        description: 'Set paragraph width',
        descriptionZh: '设置段落占位图的宽度',
      }),
    ]);
    expect(result.props[4]).toMatchObject({
      description: 'Show the arrow',
      descriptionZh: '是否显示箭头',
    });
    expect(result.props[5]).not.toHaveProperty('since');
    expect(result.props.filter((prop) => prop.name === 'nested')).toEqual([
      expect.objectContaining({
        description: 'Nested shared prop',
        descriptionZh: '嵌套共享属性',
      }),
    ]);
    expect(result.subComponentProps['Tooltip.ItemType']).toEqual([
      expect.objectContaining({
        name: 'disabled',
        description: 'Whether the menu item is disabled',
      }),
      expect.objectContaining({
        name: 'disabled',
        description: 'Whether the sub-menu is disabled',
      }),
    ]);
  });

  it('classifies an embedded shared props file without a markdown heading', () => {
    const antdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antd-cli-props-'));
    tempDirs.push(antdDir);

    const popoverDir = path.join(antdDir, 'components', 'popover');
    const sharedDir = path.join(antdDir, 'components', 'tooltip', 'shared');
    fs.mkdirSync(popoverDir, { recursive: true });
    fs.mkdirSync(sharedDir, { recursive: true });

    fs.writeFileSync(path.join(popoverDir, 'index.en-US.md'), `## API

| Property | Description | Type | Default value | Version |
| --- | --- | --- | --- | --- |
| classNames | Component semantic classes | object | - | |

<!-- Common API -->

<embed src="../tooltip/shared/sharedProps.en-US.md"></embed>
`);
    fs.writeFileSync(path.join(sharedDir, 'sharedProps.en-US.md'), `| Property | Description | Type | Default | Version |
| --- | --- | --- | --- | --- |
| classNames | Shared semantic classes | object | - | 5.23.0 |
| styles | Shared semantic styles | object | - | 5.23.0 |
`);

    const result = extractProps(antdDir, 'popover', 'Popover');

    expect(result.props.map((prop) => prop.name)).toEqual(['classNames', 'styles']);
    expect(result.props[0]).toMatchObject({
      description: 'Component semantic classes',
      since: '5.23.0',
    });
  });

  it.skipIf(process.platform === 'win32')('rejects embedded files symlinked outside the source root', () => {
    const antdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antd-cli-props-'));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antd-cli-props-outside-'));
    tempDirs.push(antdDir, outsideDir);

    const tooltipDir = path.join(antdDir, 'components', 'tooltip');
    const sharedDir = path.join(tooltipDir, 'shared');
    fs.mkdirSync(sharedDir, { recursive: true });

    const outsideFile = path.join(outsideDir, 'outside.md');
    fs.writeFileSync(outsideFile, `| Property | Description | Type | Default |
| --- | --- | --- | --- |
| leaked | Must not be read | string | - |
`);
    fs.symlinkSync(outsideFile, path.join(sharedDir, 'sharedProps.en-US.md'));
    fs.writeFileSync(path.join(tooltipDir, 'index.en-US.md'), `## API

<embed src="./shared/sharedProps.en-US.md"></embed>
`);

    expect(extractProps(antdDir, 'tooltip', 'Tooltip').props).toEqual([]);
  });
});
