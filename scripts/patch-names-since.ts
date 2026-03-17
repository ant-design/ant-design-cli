#!/usr/bin/env node
/**
 * Patch all data/*.json snapshots with:
 *  1. nameZh  — Chinese component name (from antd zh-CN frontmatter subtitle)
 *  2. since   — earliest snapshot version where the component first appears
 *
 * Run once after fix-categories.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// Chinese names (subtitle from zh-CN frontmatter, antd 5.24.9)
// ---------------------------------------------------------------------------
const NAME_ZH: Record<string, string> = {
  Affix:          '固钉',
  Alert:          '警告提示',
  Anchor:         '锚点',
  App:            '包裹组件',
  AutoComplete:   '自动完成',
  Avatar:         '头像',
  Badge:          '徽标数',
  Breadcrumb:     '面包屑',
  Button:         '按钮',
  Calendar:       '日历',
  Card:           '卡片',
  Carousel:       '走马灯',
  Cascader:       '级联选择',
  Checkbox:       '多选框',
  Collapse:       '折叠面板',
  ColorPicker:    '颜色选择器',
  ConfigProvider: '全局化配置',
  DatePicker:     '日期选择框',
  Descriptions:   '描述列表',
  Divider:        '分割线',
  Drawer:         '抽屉',
  Dropdown:       '下拉菜单',
  Empty:          '空状态',
  Flex:           '弹性布局',
  FloatButton:    '悬浮按钮',
  Form:           '表单',
  Grid:           '栅格',
  Icon:           '图标',
  Image:          '图片',
  Input:          '输入框',
  InputNumber:    '数字输入框',
  Layout:         '布局',
  List:           '列表',
  Masonry:        '瀑布流',
  Mentions:       '提及',
  Menu:           '导航菜单',
  Message:        '全局提示',
  Modal:          '对话框',
  Notification:   '通知提醒框',
  Pagination:     '分页',
  Popconfirm:     '气泡确认框',
  Popover:        '气泡卡片',
  Progress:       '进度条',
  QRCode:         '二维码',
  Radio:          '单选框',
  Rate:           '评分',
  Result:         '结果',
  Segmented:      '分段控制器',
  Select:         '选择器',
  Skeleton:       '骨架屏',
  Slider:         '滑动输入条',
  Space:          '间距',
  Spin:           '加载中',
  Splitter:       '分隔面板',
  Statistic:      '统计数值',
  Steps:          '步骤条',
  Switch:         '开关',
  Table:          '表格',
  Tabs:           '标签页',
  Tag:            '标签',
  Timeline:       '时间轴',
  TimePicker:     '时间选择框',
  Tooltip:        '文字提示',
  Tour:           '漫游式引导',
  Transfer:       '穿梭框',
  Tree:           '树形控件',
  TreeSelect:     '树选择',
  Typography:     '排版',
  Upload:         '上传',
  Watermark:      '水印',
  // deprecated v4
  BackTop:        '回到顶部',
  Comment:        '评论',
  PageHeader:     '页头',
};

// ---------------------------------------------------------------------------
// Compute `since` for every component across all snapshots
// ---------------------------------------------------------------------------
interface VersionsIndex {
  [majorKey: string]: { [minorKey: string]: string };
}

interface ComponentEntry {
  name: string;
  nameZh?: string;
  since?: string;
  [key: string]: unknown;
}

interface Snapshot {
  version: string;
  components: ComponentEntry[];
  [key: string]: unknown;
}

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function computeSinceMap(): Map<string, string> {
  // Build ordered list of all snapshot tags
  const versionsPath = path.join(DATA_DIR, 'versions.json');
  const index = JSON.parse(fs.readFileSync(versionsPath, 'utf-8')) as VersionsIndex;

  const allTags: string[] = [];
  for (const majorData of Object.values(index)) {
    for (const tag of Object.values(majorData)) {
      allTags.push(tag);
    }
  }
  allTags.sort(semverCompare);

  // For each component, record the earliest version it appears in
  const firstSeen = new Map<string, string>();

  for (const tag of allTags) {
    const snapshotPath = path.join(DATA_DIR, `v${tag}.json`);
    if (!fs.existsSync(snapshotPath)) continue;
    const store = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8')) as Snapshot;
    for (const comp of store.components) {
      if (!firstSeen.has(comp.name)) {
        firstSeen.set(comp.name, tag);
      }
    }
  }

  return firstSeen;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('Computing first-seen versions from snapshots...');
  const sinceMap = computeSinceMap();
  console.log(`Resolved since for ${sinceMap.size} unique components\n`);

  const files = fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'versions.json')
    .map((f) => path.join(DATA_DIR, f));

  let totalPatched = 0;

  for (const file of files) {
    const store = JSON.parse(fs.readFileSync(file, 'utf-8')) as Snapshot;
    let patched = 0;

    for (const comp of store.components) {
      const nameZh = NAME_ZH[comp.name];
      const since = sinceMap.get(comp.name);

      if (nameZh && comp.nameZh !== nameZh) { comp.nameZh = nameZh; patched++; }
      if (since  && comp.since  !== since)  { comp.since  = since;   patched++; }
    }

    if (patched > 0) {
      fs.writeFileSync(file, JSON.stringify(store, null, 2) + '\n');
      console.log(`${path.basename(file)}: ${patched} fields patched`);
      totalPatched += patched;
    }
  }

  console.log(`\nDone. ${totalPatched} total fields patched across ${files.length} files.`);
}

main();
