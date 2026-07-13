import fs from 'node:fs';
import path from 'node:path';
import type { ChangelogEntry } from '../../src/types.js';

const NON_COMPONENT_DIRS = new Set(['locale', 'overview', 'style', 'theme', 'version']);

/** Map emoji prefixes to change types */
function classifyChange(line: string): ChangelogEntry['changes'][0]['type'] {
  if (line.includes('🆕') || line.includes('🛠') || line.includes('🔥')) return 'feature';
  if (line.includes('🐞')) return 'fix';
  if (line.includes('💄')) return 'style';
  if (line.includes('⚡️') || line.includes('🗑')) return 'deprecation';
  if (line.includes('💥')) return 'breaking';
  return 'other';
}

function normalizeComponentName(name: string): string {
  return name.split('.')[0].replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

/** Extract a component name only when it matches a real component directory. */
function extractComponent(line: string, componentNames: Set<string>): string {
  // Lines like "- 🐞 Fix Button xxx" → "Button"
  // Lines under a component heading like "- Button\n  - 🐞 Fix xxx" are handled by context
  const match = line.match(/(?:Fix|Improve|Add|Update|Refactor|Revert|Support)\s+(\w+[\w.]*)/i);
  if (match && componentNames.has(normalizeComponentName(match[1]))) return match[1];
  return 'General';
}

/** Clean a changelog line: remove emojis, PR links, contributor mentions */
function cleanDescription(line: string): string {
  return line
    .replace(/^\s*-\s*/, '')
    .replace(/\[#\d+\]\([^)]+\)/g, '')
    .replace(/\[@?\w+\]\(https?:\/\/github\.com\/[^)]+\)/g, '')
    .replace(/@\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse a changelog markdown file into ChangelogEntry[] */
function parseChangelog(content: string, componentNames: Set<string>): ChangelogEntry[] {
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
    const changeMatch = line.match(
      /^(\s*)-\s+(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})/u,
    );
    if (changeMatch && currentVersion) {
      const isIndented = changeMatch[1].length > 0;
      if (!isIndented) currentComponent = '';
      const type = classifyChange(line);
      const desc = cleanDescription(line);
      const component = isIndented && currentComponent ? currentComponent : extractComponent(line, componentNames);

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
  const componentsDir = path.join(antdDir, 'components');
  const componentNames = new Set(
    fs.existsSync(componentsDir)
      ? fs.readdirSync(componentsDir, { withFileTypes: true })
        .filter((entry) => (
          entry.isDirectory()
          && !entry.name.startsWith('_')
          && !entry.name.startsWith('.')
          && !NON_COMPONENT_DIRS.has(entry.name)
        ))
        .map((entry) => normalizeComponentName(entry.name))
      : [],
  );
  return parseChangelog(enContent, componentNames);
}
