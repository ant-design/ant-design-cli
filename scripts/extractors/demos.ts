import fs from 'node:fs';
import path from 'node:path';
import type { DemoData } from '../../src/types.js';

/** Parse a demo .md file which has `## zh-CN` and `## en-US` sections */
function parseDemoMd(content: string): { titleZh: string; titleEn: string; descZh: string; descEn: string } {
  const result = { titleZh: '', titleEn: '', descZh: '', descEn: '' };

  const zhMatch = content.match(/^## zh-CN\s*\n([\s\S]*?)(?=^## en-US|\Z)/m);
  const enMatch = content.match(/^## en-US\s*\n([\s\S]*?)$/m);

  if (zhMatch) result.descZh = zhMatch[1].trim();
  if (enMatch) result.descEn = enMatch[1].trim();

  return result;
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
export function extractDemos(antdDir: string, dirName: string): DemoData[] {
  const demoDir = path.join(antdDir, 'components', dirName, 'demo');
  if (!fs.existsSync(demoDir)) return [];

  const enMdPath = path.join(antdDir, 'components', dirName, 'index.en-US.md');
  const zhMdPath = path.join(antdDir, 'components', dirName, 'index.zh-CN.md');
  const enMdContent = fs.existsSync(enMdPath) ? fs.readFileSync(enMdPath, 'utf-8') : '';
  const zhMdContent = fs.existsSync(zhMdPath) ? fs.readFileSync(zhMdPath, 'utf-8') : '';

  const titles = extractDemoTitles(enMdContent, zhMdContent);

  const files = fs.readdirSync(demoDir);
  const tsxFiles = files.filter((f) => f.endsWith('.tsx') && !f.startsWith('_'));
  const demos: DemoData[] = [];

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

    // Skip debug-only demos (not listed in the component doc, or marked as debug)
    const isDebug = enMdContent.includes(`src="./demo/${name}.tsx" debug`) ||
                    enMdContent.includes(`src="./demo/${name}" debug`);
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
