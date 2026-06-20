import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from './frontMatter.js';

describe('parseFrontMatter', () => {
  it('does not treat indented delimiter text as the closing delimiter', () => {
    const parsed = parseFrontMatter(`---
title: Example
description: |
  ---
  nested text
---
Body`);

    expect(parsed.data).toEqual({
      title: 'Example',
      description: '---\nnested text\n',
    });
    expect(parsed.content).toBe('Body');
  });

  it('parses front matter after a leading UTF-8 BOM', () => {
    const parsed = parseFrontMatter('\uFEFF---\ntitle: Example\n---\nBody');

    expect(parsed.data).toEqual({ title: 'Example' });
    expect(parsed.content).toBe('Body');
  });

  it('strips a leading UTF-8 BOM when no front matter exists', () => {
    const parsed = parseFrontMatter('\uFEFFBody');

    expect(parsed.data).toEqual({});
    expect(parsed.content).toBe('Body');
  });
});
