/**
 * Prepend a changelog entry with a GitHub compare link.
 * Each changed version links to its JSON file diff.
 *
 * Usage:
 *   npx tsx scripts/update-changelog.ts --old 6.3.3 --new 6.3.4 --versions "v6@6.3.4"
 */

import crypto from 'crypto';
import fs from 'fs';

const args = process.argv.slice(2);
function flag(name: string): string {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= args.length) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return args[i + 1];
}

const oldVersion = flag('old');
const newVersion = flag('new');
const versions = flag('versions');

const date = new Date().toISOString().slice(0, 10);
const repo = 'https://github.com/ant-design/ant-design-cli';
const compareUrl = `${repo}/compare/v${oldVersion}...v${newVersion}`;

// GitHub anchors file diffs with sha256 of the file path
function fileDiffUrl(filePath: string): string {
  const hash = crypto.createHash('sha256').update(filePath).digest('hex');
  return `${compareUrl}#diff-${hash}`;
}

// Turn "v5@5.24.1, v6@6.3.4" into linked markdown
const linkedVersions = versions
  .split(', ')
  .map((v) => {
    const major = v.split('@')[0].replace('v', '');
    return `[${v}](${fileDiffUrl(`data/v${major}.json`)})`;
  })
  .join(', ');

const heading = `[${newVersion}](${compareUrl})`;

const files: [string, string, string][] = [
  ['CHANGELOG.md', '# Changelog', 'Update antd metadata'],
  ['CHANGELOG.zh-CN.md', '# 更新日志', '同步 antd 元数据'],
];

for (const [file, title, msg] of files) {
  const content = fs.readFileSync(file, 'utf8');
  const entry = `## ${heading} (${date})\n\n- ${msg} (${linkedVersions})\n`;
  fs.writeFileSync(file, content.replace(title, `${title}\n\n${entry}`));
}
