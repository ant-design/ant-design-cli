import cfonts from 'cfonts';

const HELP_BANNER_GRADIENT = ['#1677ff', '#13c2c2', '#9254de'];
const HELP_LOGO_BLUE = '#1677ff';
const HELP_LOGO_RED = '#ff4d4f';
const HELP_LOGO_LINES = [
  '   ╱╲',
  ' ╱╱  ╲',
  '╱╱ ●  ❯',
  '╲╲    ╱',
  ' ╲╲  ╱',
  '   ╲╱',
];
const HELP_LOGO_WIDTH = Math.max(...HELP_LOGO_LINES.map((line) => line.length));
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
  const logoLines = HELP_LOGO_LINES.map((line) => renderLogoLine(line, color));
  const wordmarkStartLine = Math.floor((logoLines.length - wordmarkLines.length) / 2);

  return logoLines
    .map((line, index) => {
      const wordmarkLine = wordmarkLines[index - wordmarkStartLine];
      if (!wordmarkLine) {
        return line.trimEnd();
      }

      const padding = ' '.repeat(HELP_LOGO_WIDTH - HELP_LOGO_LINES[index].length + 3);
      return `${line}${padding}${wordmarkLine}`.trimEnd();
    })
    .join('\n');
}

function renderLogoLine(line: string, color: boolean): string {
  if (!color) {
    return line;
  }

  return Array.from(line)
    .map((char) => {
      if (char === '●' || char === '❯') {
        return colorText(char, HELP_LOGO_RED);
      }
      if (char.trim()) {
        return colorText(char, HELP_LOGO_BLUE);
      }
      return char;
    })
    .join('');
}

function colorText(text: string, hexColor: string): string {
  const [red, green, blue] = hexToRgb(hexColor);
  return `\u001b[38;2;${red};${green};${blue}m${text}\u001b[39m`;
}

function hexToRgb(hexColor: string): [number, number, number] {
  const color = hexColor.replace('#', '');
  return [
    Number.parseInt(color.slice(0, 2), 16),
    Number.parseInt(color.slice(2, 4), 16),
    Number.parseInt(color.slice(4, 6), 16),
  ];
}
