import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractChangelog } from '../changelog.js';

describe('extractChangelog', () => {
  it('retains emoji bullets and limits component ownership to indented changes', () => {
    const antdDir = mkdtempSync(path.join(tmpdir(), 'antd-cli-changelog-'));

    try {
      writeFileSync(
        path.join(antdDir, 'CHANGELOG.en-US.md'),
        `## 6.5.0
\`2026-07-10\`

- 📦 Internal package maintenance
- 📖 Documentation refresh
- ⌨️ Keyboard navigation improvements
- 🇳🇴 Norwegian locale update
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
