import cfonts from 'cfonts';

const HELP_BANNER_GRADIENT = ['#1677ff', '#2dd9ff', '#ff4d4f'];
const HELP_LOGO_CELLS = [
  [['', ''], ['', ''], ['', ''], ['', ''], ['', '#2dd9ff'], ['#2dd9ff', '#2dd9ff'], ['#2dd9ff', '#2dd9ff'], ['#2dd9ff', '#2dd9ff'], ['', '#2dd9ff'], ['', ''], ['', ''], ['', ''], ['', '']],
  [['', ''], ['', ''], ['', '#1890ff'], ['#2dd9ff', '#1890ff'], ['#2dd9ff', ''], ['', ''], ['', ''], ['', ''], ['#2dd9ff', ''], ['#2dd9ff', '#ff7875'], ['', '#ff7875'], ['', ''], ['', '']],
  [['', '#1890ff'], ['#1890ff', '#1890ff'], ['#1890ff', ''], ['', ''], ['', '#ff4d4f'], ['#ff7875', '#ff4d4f'], ['', '#ff4d4f'], ['', ''], ['', ''], ['#ff7875', ''], ['#ff7875', '#ff4d4f'], ['#ff7875', '#ff4d4f'], ['', '#ff4d4f']],
  [['#1890ff', ''], ['#1890ff', '#1890ff'], ['', '#1890ff'], ['', ''], ['#ff4d4f', ''], ['#ff4d4f', '#ff7875'], ['#ff4d4f', ''], ['', ''], ['', ''], ['', '#ff7875'], ['#ff4d4f', '#ff7875'], ['#ff4d4f', '#ff7875'], ['#ff4d4f', '']],
  [['', ''], ['', ''], ['#1890ff', ''], ['#1890ff', '#1677ff'], ['', '#1677ff'], ['', ''], ['', ''], ['', ''], ['', '#1677ff'], ['#ff7875', '#1677ff'], ['#ff7875', ''], ['', ''], ['', '']],
  [['', ''], ['', ''], ['', ''], ['', ''], ['#1677ff', ''], ['#1677ff', '#1677ff'], ['#1677ff', '#1677ff'], ['#1677ff', '#1677ff'], ['#1677ff', ''], ['', ''], ['', ''], ['', ''], ['', '']],
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
