import { afterEach, describe, expect, it } from 'vitest';
import { createHelpBanner } from '../output/banner.js';

const originalNoColor = process.env.NO_COLOR;
const originalForceColor = process.env.FORCE_COLOR;

afterEach(() => {
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }

  if (originalForceColor === undefined) {
    delete process.env.FORCE_COLOR;
  } else {
    process.env.FORCE_COLOR = originalForceColor;
  }
});

describe('help banner', () => {
  it('renders the wordmark without extra top padding and aligns the label', () => {
    const banner = createHelpBanner('6.5.0', false);
    const [topPadding, firstLine, secondLine, spacerLine, labelLine, dividerLine] = banner.split('\n');

    expect(topPadding).toBe('');
    expect(firstLine).toMatch(/^▄▀█/);
    expect(secondLine).toMatch(/^█▀█/);
    expect(spacerLine).toBe('');
    expect(labelLine).toBe('@ant-design/cli v6.5.0');
    expect(dividerLine).toBe('──────────────────────');
    expect(dividerLine).toHaveLength(labelLine.length);
  });

  it('renders the color banner with a truecolor gradient', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '3';

    const banner = createHelpBanner('6.5.0', true);
    const plainBanner = banner.replace(/\u001b\[[0-9;]*m/g, '');

    expect(plainBanner).toMatch(/^\n▄▀█/);
    expect(plainBanner).toContain('\n█▀█');
    expect(plainBanner).toContain('\n──────────────────────\n');
    expect(banner).toContain('\u001b[38;2;19;194;194m');
    expect(banner).toContain('\u001b[38;2;146;84;222m');
    expect(banner).not.toContain('\u001b[38;2;22;119;255m─');
    expect(plainBanner).toContain('@ant-design/cli v6.5.0');
  });
});
