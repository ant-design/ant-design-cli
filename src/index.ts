import { Command, Option } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerInfoCommand } from './commands/info.js';
import { registerDocCommand } from './commands/doc.js';
import { registerDemoCommand } from './commands/demo.js';
import { registerTokenCommand } from './commands/token.js';
import { registerDesignCommand } from './commands/design.js';
import { registerSemanticCommand } from './commands/semantic.js';
import { registerChangelogCommand } from './commands/changelog.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerUsageCommand } from './commands/usage.js';
import { registerLintCommand } from './commands/lint.js';
import { registerMigrateCommand } from './commands/migrate.js';
import { registerBugCommand, registerBugCliCommand } from './commands/bug.js';
import { registerEnvCommand } from './commands/env.js';
import { registerUpgradeCommand } from './commands/upgrade.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerSetupCommand } from './commands/setup.js';
import { checkForUpdate } from './utils/update-check.js';
import type { GlobalOptions } from './types.js';
declare const __CLI_VERSION__: string;
const CLI_VERSION = __CLI_VERSION__;
type RootOptions = Omit<GlobalOptions, 'version'> & { version?: string | boolean };

function getHelpBanner(version: string): string {
  return [
    '/\\          Ant Design CLI',
    `/  \\        antd ${version}`,
    '/ /\\ \\       Component intelligence for agents',
    '/_/  \\_\\     Query, diagnose, and migrate antd projects',
    '',
  ].join('\n');
}

function getCommandArgs(argv: readonly string[] | undefined, options: Parameters<Command['parseAsync']>[1]): readonly string[] {
  if (options?.from === 'user') {
    return argv ?? [];
  }
  return (argv ?? process.argv).slice(2);
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('antd')
    .description('CLI tool for querying antd knowledge and analyzing antd usage')
    .option('--format <format>', 'Output format: json, text, or markdown', 'text')
    .option('--version [version]', 'Target antd version (e.g. 5.20.0); omit value to output CLI version')
    .option('--lang <lang>', 'Output language: en or zh', 'en')
    .option('--detail', 'Full information output', false);

  program.addHelpText('before', `${getHelpBanner(CLI_VERSION)}\n`);

  // -V remains for compatibility; -v and bare --version print CLI version.
  program.addOption(new Option('-V, --cli-version', 'Output the CLI version number'));
  program.addOption(new Option('-v', 'Output the CLI version number'));

  // Handle -V/--cli-version via Commander event (fires before subcommand dispatch)
  program.on('option:cli-version', () => {
    // eslint-disable-next-line no-console
    console.log(CLI_VERSION);
    process.exit(0);
  });
  program.on('option:v', () => {
    // eslint-disable-next-line no-console
    console.log(CLI_VERSION);
    process.exit(0);
  });

  // Knowledge Query commands
  registerListCommand(program);
  registerInfoCommand(program);
  registerDocCommand(program);
  registerDemoCommand(program);
  registerTokenCommand(program);
  registerDesignCommand(program);
  registerSemanticCommand(program);
  registerChangelogCommand(program);

  // Project Analysis commands
  registerDoctorCommand(program);
  registerUsageCommand(program);
  registerLintCommand(program);
  registerMigrateCommand(program);
  registerEnvCommand(program);

  // MCP server
  registerMcpCommand(program);
  registerSetupCommand(program);

  // CLI Management commands
  registerUpgradeCommand(program);

  // Issue Reporting commands
  registerBugCommand(program);
  registerBugCliCommand(program);

  // Validate global options before any command runs
  program.hook('preAction', () => {
    const opts = program.opts<RootOptions>();
    if (opts.version === true) {
      // eslint-disable-next-line no-console
      console.log(CLI_VERSION);
      process.exit(0);
    }
    const validFormats = ['json', 'text', 'markdown'];
    const validLangs = ['en', 'zh'];
    if (opts.format && !validFormats.includes(opts.format)) {
      program.error(`Error: Invalid format '${opts.format}'. Must be one of: ${validFormats.join(', ')}`);
    }
    if (opts.lang && !validLangs.includes(opts.lang)) {
      program.error(`Error: Invalid language '${opts.lang}'. Must be one of: ${validLangs.join(', ')}`);
    }
  });

  program.hook('postAction', async () => {
    await checkForUpdate();
  });

  const parseAsync = program.parseAsync.bind(program);
  program.parseAsync = async (argv, options) => {
    const args = getCommandArgs(argv, options);
    if (args.length === 0) {
      program.outputHelp();
      return program;
    }
    if (args.length === 1 && args[0] === '--version') {
      // eslint-disable-next-line no-console
      console.log(CLI_VERSION);
      return program;
    }
    return parseAsync(argv, options);
  };

  return program;
}

// Auto-run when executed as CLI (skip when imported by tests)
/* v8 ignore next 3 -- entry point; only runs when invoked as a binary, not under vitest */
if (!process.env.VITEST) {
  createProgram().parseAsync();
}
