import fs from 'node:fs';
import path from 'node:path';
import type { ChangelogEntry } from '../../src/types.js';

/** Map emoji prefixes to change types */
function classifyChange(line: string): ChangelogEntry['changes'][0]['type'] {
  if (line.includes('🆕') || line.includes('🛠')) return 'feature';
  if (line.includes('🐞')) return 'fix';
  if (line.includes('💄')) return 'style';
  if (line.includes('⚡️') || line.includes('🗑')) return 'deprecation';
  if (line.includes('💥')) return 'breaking';
  return 'other';
}

/** Extract component name from a changelog line */
function extractComponent(line: string): string {
  // Lines like "- 🐞 Fix Button xxx" → "Button"
  // Lines under a component heading like "- Button\n  - 🐞 Fix xxx" are handled by context
  const match = line.match(/(?:Fix|Improve|Add|Update|Refactor|Revert|Support)\s+(\w+[\w.]*)/i);
  if (match) return match[1];
  return 'General';
}

/** Clean a changelog line: remove emojis, PR links, contributor mentions */
function cleanDescription(line: string): string {
  return line
    .replace(/^-\s*/, '')
    .replace(/\[#\d+\]\([^)]+\)/g, '')
    .replace(/@\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse a changelog markdown file into ChangelogEntry[] */
function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = content.split('\n');

  let currentVersion = '';
  let currentDate = '';
  let currentChanges: ChangelogEntry['changes'] = [];
  let currentComponent = '';

  for (const line of lines) {
    // Version heading: ## 6.3.2
    const versionMatch = line.match(/^## (\d+\.\d+\.\d+)/);
    if (versionMatch) {
      // Save previous entry
      if (currentVersion && currentChanges.length > 0) {
        entries.push({ version: currentVersion, date: currentDate, changes: currentChanges });
      }
      currentVersion = versionMatch[1];
      currentChanges = [];
      currentComponent = '';
      continue;
    }

    // Date line: `2026-03-09`
    const dateMatch = line.match(/^`(\d{4}-\d{2}-\d{2})`/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    // Component group heading: "- Select" or "- Upload" (no emoji, no details)
    const groupMatch = line.match(/^- (\w+)\s*$/);
    if (groupMatch && currentVersion) {
      currentComponent = groupMatch[1];
      continue;
    }

    // Change line with emoji
    const changeMatch = line.match(/^\s*-\s+[🐞🆕💄⚡️🗑💥🌐🛠⌨️🤖♿️]/u);
    if (changeMatch && currentVersion) {
      const type = classifyChange(line);
      const desc = cleanDescription(line);
      const component = currentComponent || extractComponent(line);

      if (desc) {
        currentChanges.push({ component, type, description: desc });
      }
      continue;
    }

    // Reset component context on empty line
    if (line.trim() === '' && currentVersion) {
      currentComponent = '';
    }
  }

  // Save last entry
  if (currentVersion && currentChanges.length > 0) {
    entries.push({ version: currentVersion, date: currentDate, changes: currentChanges });
  }

  return entries;
}

/** Extract changelog entries from antd source */
export function extractChangelog(antdDir: string): ChangelogEntry[] {
  const enPath = path.join(antdDir, 'CHANGELOG.en-US.md');
  if (!fs.existsSync(enPath)) return [];

  const enContent = fs.readFileSync(enPath, 'utf-8');
  return parseChangelog(enContent);
}
