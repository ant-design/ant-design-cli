import { Command, Option } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerInfoCommand } from './commands/info.js';
import { registerDocCommand } from './commands/doc.js';
import { registerDemoCommand } from './commands/demo.js';
import { registerTokenCommand } from './commands/token.js';
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
import { checkForUpdate } from './utils/update-check.js';
declare const __CLI_VERSION__: string;
const CLI_VERSION = __CLI_VERSION__;

export function createProgram(): Command {
  const program = new Command();

  program
    .name('antd')
    .description('CLI tool for querying antd knowledge and analyzing antd usage')
    .option('--format <format>', 'Output format: json, text, or markdown', 'text')
    .option('--version <version>', 'Target antd version (e.g. 5.20.0)')
    .option('--lang <lang>', 'Output language: en or zh', 'en')
    .option('--detail', 'Full information output', false);

  // -V for CLI version (--version is used for antd version targeting)
  program.addOption(new Option('-V, --cli-version', 'Output the CLI version number'));

  // Handle -V/--cli-version via Commander event (fires before subcommand dispatch)
  program.on('option:cli-version', () => {
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

  // CLI Management commands
  registerUpgradeCommand(program);

  // Issue Reporting commands
  registerBugCommand(program);
  registerBugCliCommand(program);

  program.hook('postAction', async () => {
    await checkForUpdate();
  });

  return program;
}

// Auto-run when executed as CLI (skip when imported by tests)
/* v8 ignore next 3 -- entry point; only runs when invoked as a binary, not under vitest */
if (!process.env.VITEST) {
  createProgram().parseAsync();
}