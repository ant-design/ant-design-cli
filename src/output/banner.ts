import cfonts from 'cfonts';

const HELP_BANNER_GRADIENT = ['#1677ff', '#13c2c2', '#9254de'];
const HELP_LOGO_CELLS = [
  [['', ''], ['', ''], ['', ''], ['', ''], ['', ''], ['', '#2fbcff'], ['#31caff', '#29d2ff'], ['#2fcfff', '#30cbff'], ['', '#3db2f7'], ['', ''], ['', ''], ['', ''], ['', ''], ['', '']],
  [['', ''], ['', ''], ['', ''], ['', '#27a3fc'], ['#2ab2ff', '#20baff'], ['#26ccff', '#27aefd'], ['#28baff', ''], ['#469bf1', ''], ['#43bbff', '#41aff8'], ['#44b0f7', '#3dc1ff'], ['', ''], ['', ''], ['', ''], ['', '']],
  [['', ''], ['', '#1d8dfc'], ['#2297ff', '#18a1ff'], ['#1babff', '#1f95ff'], ['#22a1ff', ''], ['', ''], ['', '#f8686f'], ['', '#fa6e71'], ['', ''], ['#41bdfa', ''], ['#ee6873', '#fa5763'], ['#f66b6b', '#ff6973'], ['', '#f6696c'], ['', '']],
  [['#1c87fc', '#1883ff'], ['#1593ff', '#138bff'], ['#1c8eff', '#1483ff'], ['', ''], ['', ''], ['#f54f61', '#f44153'], ['#ff5868', '#ff3d50'], ['#ff616d', '#ff4357'], ['#f85e68', '#f64a5d'], ['', ''], ['', ''], ['#f85365', '#f84456'], ['#ff5b68', '#ff4b5e'], ['#f6626a', '#f65563']],
  [['', ''], ['#157bff', ''], ['#138eff', '#157bff'], ['#1280fd', '#1187ff'], ['', '#1880ff'], ['', ''], ['#f43445', ''], ['#f63947', ''], ['', ''], ['', '#1c88ff'], ['#f83442', '#e73950'], ['#ff3e51', '#f63243'], ['#f63e4e', ''], ['', '']],
  [['', ''], ['', ''], ['', ''], ['#1576fc', ''], ['#1184ff', '#1273ff'], ['#1b7fff', '#1080ff'], ['', '#1778ff'], ['', '#1678ff'], ['#1980fd', '#1284ff'], ['#1486ff', '#1d7bff'], ['', ''], ['', ''], ['', ''], ['', '']],
  [['', ''], ['', ''], ['', ''], ['', ''], ['', ''], ['#126eff', ''], ['#0e75ff', '#166eff'], ['#1077ff', '#1972ff'], ['#1d76ff', ''], ['', ''], ['', ''], ['', ''], ['', ''], ['', '']],
] as const;
const ANSI_ESCAPE_PATTERN = /^\u001b\[[0-9;]*m/;

function shouldUseTerminalColor(): boolean {
  return Boolean(process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb');
}

export function createHelpBanner(version: string, color = shouldUseTerminalColor()): string {
  const wordmark = renderCfonts('ANT DESIGN CLI', {
    align: 'left',
    font: 'tiny',
    letterSpacing: 1,
  }, color);
  const label = `@ant-design/cli v${version}`;
  const divider = '─'.repeat(label.length);

  const wordmarkLines = wordmark
    .split('\n')
    .map((line) => trimLineStart(line).trimEnd())
    .filter(Boolean);
  const banner = addLogo(wordmarkLines, color);

  return `\n${banner}\n\n${label}\n${divider}\n`;
}

function renderCfonts(
  text: string,
  options: {
    align: 'left';
    font: string;
    letterSpacing: number;
  },
  color: boolean,
): string {
  const rendered = cfonts.render(text, {
    ...options,
    colors: ['system'],
    gradient: color ? HELP_BANNER_GRADIENT : false,
    independentGradient: true,
    lineHeight: 0,
    maxLength: '0',
    spaceless: true,
    transitionGradient: true,
  }) as { string: string };

  return rendered.string;
}

function trimLineStart(line: string): string {
  let index = 0;
  let pendingAnsi = '';

  while (index < line.length) {
    const ansiMatch = line.slice(index).match(ANSI_ESCAPE_PATTERN);
    if (ansiMatch) {
      pendingAnsi += ansiMatch[0];
      index += ansiMatch[0].length;
      continue;
    }

    if (/\s/.test(line[index])) {
      pendingAnsi = '';
      index += 1;
      continue;
    }

    break;
  }

  return `${pendingAnsi}${line.slice(index)}`;
}

function addLogo(wordmarkLines: string[], color: boolean): string {
  const logoLines = HELP_LOGO_CELLS.map((row) => renderLogoLine(row, color));
  const wordmarkStartLine = Math.floor((logoLines.length - wordmarkLines.length) / 2);

  return logoLines
    .map((line, index) => {
      const wordmarkLine = wordmarkLines[index - wordmarkStartLine];
      if (!wordmarkLine) {
        return line.trimEnd();
      }

      return `${line}   ${wordmarkLine}`.trimEnd();
    })
    .join('\n');
}

function renderLogoLine(row: readonly (readonly [string, string])[], color: boolean): string {
  return row
    .map(([top, bottom]) => renderLogoCell(top, bottom, color))
    .join('');
}

function renderLogoCell(top: string, bottom: string, color: boolean): string {
  if (!top && !bottom) {
    return ' ';
  }

  if (!color) {
    if (top && bottom) {
      return '█';
    }
    return top ? '▀' : '▄';
  }

  if (top && bottom) {
    return `${foreground(top)}${background(bottom)}▀\u001b[39m\u001b[49m`;
  }

  return top ? `${foreground(top)}▀\u001b[39m` : `${foreground(bottom)}▄\u001b[39m`;
}

function foreground(hexColor: string): string {
  const [red, green, blue] = hexToRgb(hexColor);
  return `\u001b[38;2;${red};${green};${blue}m`;
}

function background(hexColor: string): string {
  const [red, green, blue] = hexToRgb(hexColor);
  return `\u001b[48;2;${red};${green};${blue}m`;
}

function hexToRgb(hexColor: string): [number, number, number] {
  const color = hexColor.replace('#', '');
  return [
    Number.parseInt(color.slice(0, 2), 16),
    Number.parseInt(color.slice(2, 4), 16),
    Number.parseInt(color.slice(4, 6), 16),
  ];
}
