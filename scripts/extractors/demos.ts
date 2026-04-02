import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DemoData } from '../../src/types.js';

/** Parse a demo .md file which has `## zh-CN` and `## en-US` sections (v4+ format) */
function parseDemoMd(content: string): { titleZh: string; titleEn: string; descZh: string; descEn: string } {
  const result = { titleZh: '', titleEn: '', descZh: '', descEn: '' };

  const zhMatch = content.match(/^## zh-CN\s*\n([\s\S]*?)(?=^## en-US|\Z)/m);
  const enMatch = content.match(/^## en-US\s*\n([\s\S]*?)$/m);

  if (zhMatch) result.descZh = zhMatch[1].trim();
  if (enMatch) result.descEn = enMatch[1].trim();

  return result;
}

/** Parse v3 demo .md file with frontmatter and embedded JSX code block */
function parseV3DemoMd(content: string): {
  titleEn: string;
  titleZh: string;
  descEn: string;
  descZh: string;
  code: string;
} {
  const parsed = matter(content);
  const titleObj = parsed.data.title || {};
  const titleEn = typeof titleObj === 'string' ? titleObj : titleObj['en-US'] || '';
  const titleZh = typeof titleObj === 'string' ? '' : titleObj['zh-CN'] || '';

  // Extract zh-CN and en-US sections
  const zhMatch = parsed.content.match(/^## zh-CN\s*\n([\s\S]*?)(?=^## en-US|\Z)/m);
  const enMatch = parsed.content.match(/^## en-US\s*\n([\s\S]*?)$/m);

  const descZh = zhMatch ? zhMatch[1].trim() : '';
  const descEn = enMatch ? enMatch[1].trim() : '';

  // Extract JSX code block
  const codeMatch = parsed.content.match(/```jsx\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : '';

  return { titleEn, titleZh, descEn, descZh, code };
}

/** Extract demo title from the component markdown's `<code>` tags */
function extractDemoTitles(
  enMdContent: string,
  zhMdContent: string,
): Map<string, { titleEn: string; titleZh: string }> {
  const titles = new Map<string, { titleEn: string; titleZh: string }>();

  // Parse <code src="./demo/basic.tsx">Title</code>
  const enRegex = /<code\s+src="\.\/demo\/([^"]+?)(?:\.tsx)?"\s*[^>]*>([^<]*)<\/code>/g;
  let match;
  while ((match = enRegex.exec(enMdContent)) !== null) {
    const name = match[1].replace(/\.tsx$/, '');
    titles.set(name, { titleEn: match[2].trim(), titleZh: '' });
  }

  const zhRegex = /<code\s+src="\.\/demo\/([^"]+?)(?:\.tsx)?"\s*[^>]*>([^<]*)<\/code>/g;
  while ((match = zhRegex.exec(zhMdContent)) !== null) {
    const name = match[1].replace(/\.tsx$/, '');
    const existing = titles.get(name);
    if (existing) {
      existing.titleZh = match[2].trim();
    }
  }

  return titles;
}

/** Extract all demos for a component */
export function extractDemos(antdDir: string, dirName: string, majorVersion: string = 'v5'): DemoData[] {
  const demoDir = path.join(antdDir, 'components', dirName, 'demo');
  if (!fs.existsSync(demoDir)) return [];

  const enMdPath = path.join(antdDir, 'components', dirName, 'index.en-US.md');
  const zhMdPath = path.join(antdDir, 'components', dirName, 'index.zh-CN.md');
  const enMdContent = fs.existsSync(enMdPath) ? fs.readFileSync(enMdPath, 'utf-8') : '';
  const zhMdContent = fs.existsSync(zhMdPath) ? fs.readFileSync(zhMdPath, 'utf-8') : '';

  const demos: DemoData[] = [];

  // v3 format: .md files with embedded JSX code blocks
  if (majorVersion === 'v3') {
    const files = fs.readdirSync(demoDir);
    const mdFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('_'));

    for (const md of mdFiles) {
      const name = md.replace(/\.md$/, '');
      const content = fs.readFileSync(path.join(demoDir, md), 'utf-8');
      const parsed = parseV3DemoMd(content);

      // Skip if no code found
      if (!parsed.code) continue;

      demos.push({
        name,
        title: parsed.titleEn || name,
        titleZh: parsed.titleZh || '',
        description: parsed.descEn,
        descriptionZh: parsed.descZh,
        code: parsed.code,
      });
    }

    return demos;
  }

  // v4+ format: .tsx files with separate .md descriptions
  const titles = extractDemoTitles(enMdContent, zhMdContent);

  const files = fs.readdirSync(demoDir);
  const tsxFiles = files.filter((f) => f.endsWith('.tsx') && !f.startsWith('_'));

  for (const tsx of tsxFiles) {
    const name = tsx.replace(/\.tsx$/, '');
    const code = fs.readFileSync(path.join(demoDir, tsx), 'utf-8');

    // Check for matching .md file with descriptions
    const mdFile = path.join(demoDir, `${name}.md`);
    let descEn = '';
    let descZh = '';
    if (fs.existsSync(mdFile)) {
      const parsed = parseDemoMd(fs.readFileSync(mdFile, 'utf-8'));
      descEn = parsed.descEn;
      descZh = parsed.descZh;
    }

    const titleInfo = titles.get(name);

    // Skip debug-only demos (tagged with the `debug` attribute in the component doc)
    const isDebug = new RegExp(`<code[^>]*src="[^"]*/${name}(?:\\.tsx)?"[^>]*\\bdebug\\b`).test(enMdContent);
    if (isDebug) continue;

    // Skip if not referenced in the component doc at all
    if (!titles.has(name)) continue;

    demos.push({
      name,
      title: titleInfo?.titleEn || name,
      titleZh: titleInfo?.titleZh || '',
      description: descEn,
      descriptionZh: descZh,
      code,
    });
  }

  return demos;
}
