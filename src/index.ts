import { Command, Option } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerInfoCommand } from './commands/info.js';
import { registerDemoCommand } from './commands/demo.js';
import { registerTokenCommand } from './commands/token.js';
import { registerSearchCommand } from './commands/search.js';
import { registerSemanticCommand } from './commands/structure.js';
import { registerChangelogCommand } from './commands/diff.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerUsageCommand } from './commands/usage.js';
import { registerLintCommand } from './commands/lint.js';
import { registerMigrateCommand } from './commands/migrate.js';

const CLI_VERSION = '0.1.0';

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

// Knowledge Query commands
registerListCommand(program);
registerInfoCommand(program);
registerDemoCommand(program);
registerTokenCommand(program);
registerSearchCommand(program);
registerSemanticCommand(program);
registerChangelogCommand(program);

// Project Analysis commands
registerDoctorCommand(program);
registerUsageCommand(program);
registerLintCommand(program);
registerMigrateCommand(program);

// Handle -V before subcommand dispatch
const idx = process.argv.indexOf('-V');
const idx2 = process.argv.indexOf('--cli-version');
if (idx !== -1 || idx2 !== -1) {
  // eslint-disable-next-line no-console
  console.log(CLI_VERSION);
  process.exit(0);
}

program.parse();
