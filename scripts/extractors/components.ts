import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface ComponentMeta {
  name: string;
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

/** Discover and parse all component metadata from an antd source directory */
export function extractComponents(antdDir: string): ComponentMeta[] {
  const componentsDir = path.join(antdDir, 'components');
  const dirs = fs.readdirSync(componentsDir, { withFileTypes: true });
  const components: ComponentMeta[] = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const enPath = path.join(componentsDir, dir.name, 'index.en-US.md');
    const zhPath = path.join(componentsDir, dir.name, 'index.zh-CN.md');

    if (!fs.existsSync(enPath)) continue;

    const enRaw = fs.readFileSync(enPath, 'utf-8');
    const enParsed = matter(enRaw);
    const fm = enParsed.data;

    // Skip non-component entries (like _util, overview, etc.)
    if (!fm.category || fm.category === 'Components' && fm.title === 'Overview') continue;
    if (dir.name.startsWith('_')) continue;

    const componentName = fm.title || toPascalCase(dir.name);

    let descriptionZh = '';
    let categoryZh = '';
    let whenToUseZh = '';
    if (fs.existsSync(zhPath)) {
      const zhRaw = fs.readFileSync(zhPath, 'utf-8');
      const zhParsed = matter(zhRaw);
      descriptionZh = zhParsed.data.description || '';
      categoryZh = zhParsed.data.group?.title || '';
      whenToUseZh = extractWhenToUse(zhParsed.content, 'zh');
    }

    components.push({
      name: componentName,
      dirName: dir.name,
      category: fm.group?.title || fm.category || '',
      categoryZh,
      description: fm.description || '',
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
