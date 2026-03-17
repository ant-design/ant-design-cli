#!/usr/bin/env node
/**
 * One-time fix: patch category/categoryZh on all data/*.json snapshots.
 *
 * Root cause: the extractor used `fm.group?.title` which only handles the object form
 * of `group` in antd v5 frontmatter. The plain-string form (`group: Data Display`) and
 * the v4 `type` field were silently ignored, leaving most components with the unhelpful
 * top-level category "Components".
 *
 * This script:
 *  1. Applies known correct categories from the antd docs to every component entry
 *     that currently has category === "Components"
 *  2. Removes "Components Overview" (not a real component) from every snapshot
 *  3. Writes the files in-place
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// Canonical component → category mapping (en + zh)
// Based on official antd v4/v5/v6 documentation groupings.
// ---------------------------------------------------------------------------
interface CategoryEntry { en: string; zh: string }

const CATEGORY_MAP: Record<string, CategoryEntry> = {
  // General
  Button:       { en: 'General',    zh: '通用' },
  FloatButton:  { en: 'General',    zh: '通用' },
  Icon:         { en: 'General',    zh: '通用' },
  Typography:   { en: 'General',    zh: '通用' },

  // Layout
  Divider:      { en: 'Layout',     zh: '布局' },
  Flex:         { en: 'Layout',     zh: '布局' },
  Grid:         { en: 'Layout',     zh: '布局' },
  Layout:       { en: 'Layout',     zh: '布局' },
  Space:        { en: 'Layout',     zh: '布局' },

  // Navigation
  Affix:        { en: 'Navigation', zh: '导航' },
  Anchor:       { en: 'Navigation', zh: '导航' },
  Breadcrumb:   { en: 'Navigation', zh: '导航' },
  Dropdown:     { en: 'Navigation', zh: '导航' },
  Menu:         { en: 'Navigation', zh: '导航' },
  Pagination:   { en: 'Navigation', zh: '导航' },
  Steps:        { en: 'Navigation', zh: '导航' },

  // Data Entry
  AutoComplete: { en: 'Data Entry', zh: '数据录入' },
  Cascader:     { en: 'Data Entry', zh: '数据录入' },
  Checkbox:     { en: 'Data Entry', zh: '数据录入' },
  ColorPicker:  { en: 'Data Entry', zh: '数据录入' },
  DatePicker:   { en: 'Data Entry', zh: '数据录入' },
  Form:         { en: 'Data Entry', zh: '数据录入' },
  Input:        { en: 'Data Entry', zh: '数据录入' },
  InputNumber:  { en: 'Data Entry', zh: '数据录入' },
  Mentions:     { en: 'Data Entry', zh: '数据录入' },
  Radio:        { en: 'Data Entry', zh: '数据录入' },
  Rate:         { en: 'Data Entry', zh: '数据录入' },
  Select:       { en: 'Data Entry', zh: '数据录入' },
  Slider:       { en: 'Data Entry', zh: '数据录入' },
  Switch:       { en: 'Data Entry', zh: '数据录入' },
  TimePicker:   { en: 'Data Entry', zh: '数据录入' },
  Transfer:     { en: 'Data Entry', zh: '数据录入' },
  TreeSelect:   { en: 'Data Entry', zh: '数据录入' },
  Upload:       { en: 'Data Entry', zh: '数据录入' },

  // Data Display
  Avatar:       { en: 'Data Display', zh: '数据展示' },
  Badge:        { en: 'Data Display', zh: '数据展示' },
  Calendar:     { en: 'Data Display', zh: '数据展示' },
  Card:         { en: 'Data Display', zh: '数据展示' },
  Carousel:     { en: 'Data Display', zh: '数据展示' },
  Collapse:     { en: 'Data Display', zh: '数据展示' },
  Descriptions: { en: 'Data Display', zh: '数据展示' },
  Empty:        { en: 'Data Display', zh: '数据展示' },
  Image:        { en: 'Data Display', zh: '数据展示' },
  List:         { en: 'Data Display', zh: '数据展示' },
  Masonry:      { en: 'Data Display', zh: '数据展示' },
  Popover:      { en: 'Data Display', zh: '数据展示' },
  QRCode:       { en: 'Data Display', zh: '数据展示' },
  Segmented:    { en: 'Data Display', zh: '数据展示' },
  Statistic:    { en: 'Data Display', zh: '数据展示' },
  Table:        { en: 'Data Display', zh: '数据展示' },
  Tabs:         { en: 'Data Display', zh: '数据展示' },
  Tag:          { en: 'Data Display', zh: '数据展示' },
  Timeline:     { en: 'Data Display', zh: '数据展示' },
  Tooltip:      { en: 'Data Display', zh: '数据展示' },
  Tour:         { en: 'Data Display', zh: '数据展示' },
  Tree:         { en: 'Data Display', zh: '数据展示' },

  // Feedback
  Alert:        { en: 'Feedback', zh: '反馈' },
  Drawer:       { en: 'Feedback', zh: '反馈' },
  Message:      { en: 'Feedback', zh: '反馈' },
  Modal:        { en: 'Feedback', zh: '反馈' },
  Notification: { en: 'Feedback', zh: '反馈' },
  Popconfirm:   { en: 'Feedback', zh: '反馈' },
  Progress:     { en: 'Feedback', zh: '反馈' },
  Result:       { en: 'Feedback', zh: '反馈' },
  Skeleton:     { en: 'Feedback', zh: '反馈' },
  Spin:         { en: 'Feedback', zh: '反馈' },
  Watermark:    { en: 'Feedback', zh: '反馈' },

  // Other
  App:            { en: 'Other', zh: '其他' },
  BackTop:        { en: 'Other', zh: '其他' },
  ConfigProvider: { en: 'Other', zh: '其他' },
  Splitter:       { en: 'Other', zh: '其他' },

  // Deprecated v4-only components
  Comment:        { en: 'Data Display', zh: '数据展示' },
  PageHeader:     { en: 'Navigation',   zh: '导航' },
};

// Names that are NOT real components and should be removed from all snapshots
const EXCLUDED_NAMES = new Set(['Components Overview']);

// ---------------------------------------------------------------------------

interface ComponentEntry {
  name: string;
  category: string;
  categoryZh?: string;
  [key: string]: unknown;
}

interface Snapshot {
  components: ComponentEntry[];
  [key: string]: unknown;
}

function patchSnapshot(filePath: string): { patched: number; removed: number } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const store = JSON.parse(raw) as Snapshot;

  let patched = 0;
  let removed = 0;

  const kept: ComponentEntry[] = [];
  for (const comp of store.components) {
    // Remove non-component entries
    if (EXCLUDED_NAMES.has(comp.name)) {
      removed++;
      continue;
    }
    kept.push(comp);

    // Patch category if it's still the generic "Components" fallback
    if (comp.category === 'Components') {
      const mapping = CATEGORY_MAP[comp.name];
      if (mapping) {
        comp.category = mapping.en;
        comp.categoryZh = mapping.zh;
        patched++;
      }
    }
    // Also fill in missing categoryZh for entries that have a correct en category
    if (comp.category !== 'Components' && !comp.categoryZh) {
      const mapping = CATEGORY_MAP[comp.name];
      if (mapping && mapping.en === comp.category) {
        comp.categoryZh = mapping.zh;
        patched++;
      }
    }
  }

  store.components = kept;
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2) + '\n');
  return { patched, removed };
}

function main() {
  const files = fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'versions.json')
    .map((f) => path.join(DATA_DIR, f));

  let totalPatched = 0;
  let totalRemoved = 0;

  for (const file of files) {
    const { patched, removed } = patchSnapshot(file);
    if (patched > 0 || removed > 0) {
      console.log(`${path.basename(file)}: patched ${patched} categories, removed ${removed} entries`);
    }
    totalPatched += patched;
    totalRemoved += removed;
  }

  console.log(`\nDone. Total: ${totalPatched} categories fixed, ${totalRemoved} entries removed across ${files.length} files.`);
}

main();
