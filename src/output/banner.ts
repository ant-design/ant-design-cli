import cfonts from 'cfonts';

const HELP_BANNER_GRADIENT = ['#1677ff', '#2dd9ff', '#ff4d4f'];
const HELP_LOGO_CELLS = [
  [['', ''], ['', ''], ['', ''], ['', ''], ['', '#3ab7ff'], ['#44c3ff', '#26c1ff'], ['#2dd9ff', '#2dc8ff'], ['#33e5ff', '#39affc'], ['', '#50a7f1'], ['', ''], ['', ''], ['', ''], ['', '']],
  [['', ''], ['', ''], ['', '#269aff'], ['#2daaff', '#1ca5ff'], ['#21b4ff', '#22a8fd'], ['#25b4fd', ''], ['#6493ea', ''], ['#42a2f5', ''], ['#3eb5fa', '#3fbafb'], ['#35c4ff', '#61a9dc'], ['', '#f67272'], ['', ''], ['', '']],
  [['', '#1a88ff'], ['#1f8dff', '#1591ff'], ['#189dff', '#1f90ff'], ['#2098fd', ''], ['', ''], ['', '#f54f5f'], ['#f57c7f', '#ff606e'], ['', '#f75b67'], ['', ''], ['#ff555a', ''], ['#ff636c', '#f95667'], ['#f86e6e', '#fc5a67'], ['', '#f65f67']],
  [['#1583fc', ''], ['#1389ff', '#147aff'], ['#1382fd', '#1287ff'], ['', '#137ffd'], ['', ''], ['#f43b4c', ''], ['#ff3f53', '#f63c51'], ['#f54355', ''], ['', ''], ['', '#ff2e34'], ['#f94153', '#ff384a'], ['#fc485b', '#f43a4b'], ['#f65363', '']],
  [['', ''], ['', ''], ['#1577ff', ''], ['#107eff', '#1671ff'], ['#1780ff', '#0f79ff'], ['', '#1678fd'], ['', '#447cee'], ['', '#1579fd'], ['#1785ff', '#137fff'], ['#4473d8', '#0b88ff'], ['#f63141', ''], ['', ''], ['', '']],
  [['', ''], ['', ''], ['', ''], ['', ''], ['#1669ff', ''], ['#0e70ff', ''], ['#1078ff', '#1374ff'], ['#1275ff', ''], ['#267bff', ''], ['', ''], ['', ''], ['', ''], ['', '']],
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

  return `${logoLines.map((line) => line.trimEnd()).join('\n')}\n\n${wordmarkLines.join('\n')}`;
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
