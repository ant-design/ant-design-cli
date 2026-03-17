import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface ComponentMeta {
  name: string;
  nameZh: string;
  dirName: string;
  category: string;
  categoryZh: string;
  description: string;
  descriptionZh: string;
  whenToUse: string;
  whenToUseZh: string;
  subComponents: string[];
}

/** Convert kebab-case directory name to PascalCase component name */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** Extract "When To Use" section from markdown content (after frontmatter) */
function extractWhenToUse(content: string, lang: 'en' | 'zh'): string {
  const heading = lang === 'en' ? /^## When To Use/m : /^## 何时使用/m;
  const match = content.match(heading);
  if (!match || match.index === undefined) return '';

  const start = match.index + match[0].length;
  const rest = content.slice(start);
  // Take content until the next ## heading
  const nextHeading = rest.match(/^## /m);
  const section = nextHeading?.index !== undefined ? rest.slice(0, nextHeading.index) : rest;
  return section.trim();
}

/** Extract sub-component names from markdown API tables (e.g., ### Button.Group) */
function extractSubComponents(enContent: string, componentName: string): string[] {
  const subs: string[] = [];
  const regex = new RegExp(`^###\\s+(${componentName}\\.\\w+)`, 'gm');
  let match;
  while ((match = regex.exec(enContent)) !== null) {
    subs.push(match[1]);
  }
  return subs;
}

/**
 * Resolve the sub-category from component frontmatter.
 *
 * antd uses several formats across versions:
 *   v4:  type: "General"              (plain string field)
 *   v5+: group: "Data Display"        (plain string)
 *   v5+: group: { title: "General" }  (object with title)
 *
 * Falls back to `category` (usually the top-level "Components") if none found.
 */
function resolveCategory(fm: Record<string, unknown>): string {
  const g = fm.group;
  if (typeof g === 'string' && g.length > 0) return g;
  if (g !== null && typeof g === 'object') {
    const title = (g as Record<string, unknown>).title;
    if (typeof title === 'string' && title.length > 0) return title;
  }
  // v4 stores sub-category in `type`
  if (typeof fm.type === 'string' && fm.type.length > 0) return fm.type;
  return typeof fm.category === 'string' ? fm.category : '';
}

/** Discover and parse all component metadata from an antd source directory */
export function extractComponents(antdDir: string): ComponentMeta[] {
  const componentsDir = path.join(antdDir, 'components');
  const dirs = fs.readdirSync(componentsDir, { withFileTypes: true });
  const components: ComponentMeta[] = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    if (dir.name.startsWith('_')) continue;

    const enPath = path.join(componentsDir, dir.name, 'index.en-US.md');
    const zhPath = path.join(componentsDir, dir.name, 'index.zh-CN.md');

    if (!fs.existsSync(enPath)) continue;

    const enRaw = fs.readFileSync(enPath, 'utf-8');
    const enParsed = matter(enRaw);
    const fm = enParsed.data;

    // Skip non-component entries: no category, overview pages, or utility dirs
    if (!fm.category) continue;
    const componentName = (fm.title as string | undefined) || toPascalCase(dir.name);
    // Skip "Components Overview" and similar overview pages (no description, no group/type)
    const category = resolveCategory(fm);
    if (category === 'Components' && !fm.description) continue;

    let nameZh = '';
    let descriptionZh = '';
    let categoryZh = '';
    let whenToUseZh = '';
    if (fs.existsSync(zhPath)) {
      const zhRaw = fs.readFileSync(zhPath, 'utf-8');
      const zhParsed = matter(zhRaw);
      nameZh = (zhParsed.data.subtitle as string | undefined) || '';
      descriptionZh = (zhParsed.data.description as string | undefined) || '';
      categoryZh = resolveCategory(zhParsed.data);
      whenToUseZh = extractWhenToUse(zhParsed.content, 'zh');
    }

    components.push({
      name: componentName,
      nameZh,
      dirName: dir.name,
      category,
      categoryZh,
      description: (fm.description as string | undefined) || '',
      descriptionZh,
      whenToUse: extractWhenToUse(enParsed.content, 'en'),
      whenToUseZh,
      subComponents: extractSubComponents(enParsed.content, componentName),
    });
  }

  // Sort by category then name
  components.sort((a, b) => a.name.localeCompare(b.name));
  return components;
}
