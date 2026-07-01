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
    const lines = banner.split('\n');

    expect(lines[0]).toBe('');
    expect(lines[1]).toBe('       ▄██▄');
    expect(lines[2]).toBe('     ▄██▀▀██▄');
    expect(lines[3]).toBe('   ▄██▀    ▀▀ ▄');
    expect(lines[4]).toBe(' ▄██▀  ▄▄▄▄  ▀██▄');
    expect(lines[5]).toBe('███    ████    ███');
    expect(lines[6]).toBe(' ▀██▄  ▀▀▀▀  ▄██▀');
    expect(lines[7]).toBe('   ▀██▄    ▄▄ ▀');
    expect(lines[8]).toBe('     ▀██▄▄██▀');
    expect(lines[9]).toBe('       ▀██▀');
    expect(lines[10]).toBe('');
    expect(lines[11]).toMatch(/^▄▀█/);
    expect(lines[12]).toMatch(/^█▀█/);
    expect(lines[13]).toBe('');
    expect(lines[14]).toBe('@ant-design/cli v6.5.0');
    expect(lines[15]).toBe('──────────────────────');
    expect(lines[15]).toHaveLength(lines[14].length);
  });

  it('renders the color banner with a truecolor gradient', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '3';

    const banner = createHelpBanner('6.5.0', true);
    const plainBanner = banner.replace(/\u001b\[[0-9;]*m/g, '');

    expect(plainBanner).toMatch(/^\n       ▄▀▀▄/);
    expect(plainBanner).toContain('\n   ▄▀▀▀    ▀▀ ▄\n');
    expect(plainBanner).toContain('\n▀▀▀    ▀▀▀▀    ▀▀▀\n');
    expect(plainBanner).toContain('\n     ▀▀▀▄▄▀▀▀\n');
    expect(plainBanner).toContain('\n▄▀█ █▄ █ ▀█▀');
    expect(plainBanner).toContain('\n█▀█ █ ▀█  █');
    expect(plainBanner).toContain('\n──────────────────────\n');
    expect(banner).toContain('\u001b[38;2;');
    expect(banner).toContain('\u001b[48;2;');
    expect(banner).toContain('\u001b[38;2;36;191;255m');
    expect(banner).toContain('\u001b[38;2;249;106;103m');
    expect(banner).not.toContain('\\u001b');
    expect(banner).not.toContain('\u001b[38;2;146;84;222m');
    expect(banner).not.toContain('\u001b[38;2;22;119;255m─');
    expect(plainBanner).toContain('@ant-design/cli v6.5.0');
  });
});
