import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractChangelog } from '../changelog.js';

describe('extractChangelog', () => {
  it('retains emoji bullets and limits component ownership to indented changes', () => {
    const antdDir = mkdtempSync(path.join(tmpdir(), 'antd-cli-changelog-'));

    try {
      mkdirSync(path.join(antdDir, 'components', 'alert'), { recursive: true });
      writeFileSync(
        path.join(antdDir, 'CHANGELOG.en-US.md'),
        `## 6.5.0
\`2026-07-10\`

- 📦 Internal package maintenance
- 📖 Documentation refresh
- ⌨️ Keyboard navigation improvements
- 🇳🇴 Norwegian locale update
- 🔥 Add the antd DESIGN.md document
- 📖 Update Ant Design CLI docs
- 🐞 Fix disabled FloatButton.Group style
- Button
  - 🐞 Fix focus handling
  - 🆕 Add loading state
- 🔥 Add Alert hot-path support
`,
      );

      expect(extractChangelog(antdDir)).toEqual([
        {
          version: '6.5.0',
          date: '2026-07-10',
          changes: [
            { component: 'General', type: 'other', description: '📦 Internal package maintenance' },
            { component: 'General', type: 'other', description: '📖 Documentation refresh' },
            { component: 'General', type: 'other', description: '⌨️ Keyboard navigation improvements' },
            { component: 'General', type: 'other', description: '🇳🇴 Norwegian locale update' },
            { component: 'General', type: 'feature', description: '🔥 Add the antd DESIGN.md document' },
            { component: 'General', type: 'other', description: '📖 Update Ant Design CLI docs' },
            { component: 'General', type: 'fix', description: '🐞 Fix disabled FloatButton.Group style' },
            { component: 'Button', type: 'fix', description: '🐞 Fix focus handling' },
            { component: 'Button', type: 'feature', description: '🆕 Add loading state' },
            { component: 'Alert', type: 'feature', description: '🔥 Add Alert hot-path support' },
          ],
        },
      ]);
    } finally {
      rmSync(antdDir, { recursive: true, force: true });
    }
  });
});
