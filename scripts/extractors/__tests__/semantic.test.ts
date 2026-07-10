import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSemantic } from '../semantic.js';

describe('extractSemantic', () => {
  it('extracts quoted dotted keys through bracket locale access', () => {
    const antdDir = mkdtempSync(path.join(tmpdir(), 'antd-cli-semantic-'));
    const demoDir = path.join(antdDir, 'components', 'select', 'demo');

    try {
      mkdirSync(demoDir, { recursive: true });
      writeFileSync(
        path.join(demoDir, '_semantic.tsx'),
        `const locales = {
  en: {
    'popup.root': 'Preview root',
  },
  cn: {
    'popup.root': '预览根节点',
  },
};

const semantics = [
  { name: 'popup.root', desc: locale['popup.root'] },
];
`,
      );

      expect(extractSemantic(antdDir, 'select')).toEqual([
        {
          key: 'popup.root',
          description: 'Preview root',
          descriptionZh: '预览根节点',
        },
      ]);
    } finally {
      rmSync(antdDir, { recursive: true, force: true });
    }
  });
});
