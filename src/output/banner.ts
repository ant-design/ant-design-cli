import cfonts from 'cfonts';

const HELP_BANNER_GRADIENT = ['#1677ff', '#13c2c2', '#9254de'];
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

  const banner = wordmark
    .split('\n')
    .map((line) => trimLineStart(line).trimEnd())
    .join('\n')
    .trimEnd();

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
