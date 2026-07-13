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
    root: 'Root',
    'popup.root': 'Preview root',
  },
  cn: {
    root: '根节点',
    'popup.root': '预览根节点',
  },
};

const semantics = [
  { name: 'root', desc: locale.root },
  { name: 'popup.root', desc: locale['popup.root'] },
];
`,
      );

      expect(extractSemantic(antdDir, 'select')).toEqual([
        {
          key: 'root',
          description: 'Root',
          descriptionZh: '根节点',
        },
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

  it('preserves escaped quotes and backslashes in localized descriptions', () => {
    const antdDir = mkdtempSync(path.join(tmpdir(), 'antd-cli-semantic-'));
    const demoDir = path.join(antdDir, 'components', 'select', 'demo');

    try {
      mkdirSync(demoDir, { recursive: true });
      writeFileSync(
        path.join(demoDir, '_semantic.tsx'),
        String.raw`const locales = {
  en: {
    popup: 'Preview\'s \\ root',
  },
  cn: {
    popup: '弹层\'的 \\ 根节点',
  },
};

const semantics = [
  { name: 'popup.root', desc: locale.popup },
];
`,
      );

      expect(extractSemantic(antdDir, 'select')).toEqual([
        {
          key: 'popup.root',
          description: "Preview's \\ root",
          descriptionZh: "弹层'的 \\ 根节点",
        },
      ]);
    } finally {
      rmSync(antdDir, { recursive: true, force: true });
    }
  });
});
