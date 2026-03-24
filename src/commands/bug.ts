import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { createError, ErrorCodes, printError } from '../output/error.js';
import { output } from '../output/formatter.js';
import {
  collectAntdEnv,
  collectCliEnv,
  buildAntdIssueBody,
  buildCliIssueBody,
  buildIssueUrl,
  checkGhAvailable,
  submitViaGh,
} from '../utils/issue.js';

const ANTD_REPO = 'ant-design/ant-design';
const CLI_REPO = 'ant-design/ant-design-cli';

export function registerBugCommand(program: Command): void {
  program
    .command('bug')
    .description('Report a bug to the antd repository')
    .requiredOption('--title <title>', 'Issue title')
    .option('--reproduction <url>', 'Reproduction link')
    .option('--steps <text>', 'Steps to reproduce')
    .option('--expected <text>', 'Expected behavior')
    .option('--actual <text>', 'Actual behavior')
    .option('--extra <text>', 'Additional comments')
    .option('--submit', 'Submit via gh CLI instead of previewing', false)
    .action((cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const env = collectAntdEnv(process.cwd(), opts.version);
      const body = buildAntdIssueBody({
        reproduction: cmdOpts.reproduction,
        steps: cmdOpts.steps,
        expected: cmdOpts.expected,
        actual: cmdOpts.actual,
        extra: cmdOpts.extra,
        env,
      });
      const title = cmdOpts.title;

      if (cmdOpts.submit) {
        if (!checkGhAvailable()) {
          printError(
            createError(ErrorCodes.GH_NOT_FOUND, 'gh CLI is not installed or not in PATH', 'Install GitHub CLI: https://cli.github.com/ — or remove --submit to get a pre-filled URL instead'),
            opts.format,
          );
          process.exit(1);
        }
        try {
          const result = submitViaGh(ANTD_REPO, title, body);
          if (opts.format === 'json') {
            output({ repo: ANTD_REPO, title, issueNumber: result.issueNumber, url: result.url }, 'json');
          } else {
            console.log(`Issue created: ${result.url}`);
          }
        } catch (err: unknown) {
          printError(
            createError(ErrorCodes.GH_SUBMIT_FAILED, `Failed to create issue: ${err.message}`, 'Check your gh authentication with `gh auth status`'),
            opts.format,
          );
          process.exit(2);
        }
        return;
      }

      // Preview mode
      const url = buildIssueUrl(ANTD_REPO, title, body);

      if (opts.format === 'json') {
        output({ repo: ANTD_REPO, title, body, url }, 'json');
      } else if (opts.format === 'markdown') {
        console.log(body);
      } else {
        console.log(`Repository: ${ANTD_REPO}`);
        console.log(`Title: ${title}`);
        console.log('');
        console.log('--- Issue Body ---');
        console.log(body);
        console.log('--- End ---');
        console.log('');
        console.log('To submit, re-run with --submit flag.');
      }
    });
}

export function registerBugCliCommand(program: Command): void {
  program
    .command('bug-cli')
    .description('Report a bug to the ant-design-cli repository')
    .requiredOption('--title <title>', 'Issue title')
    .option('--description <desc>', 'Problem description')
    .option('--steps <text>', 'Steps to reproduce')
    .option('--expected <text>', 'Expected behavior')
    .option('--actual <text>', 'Actual behavior')
    .option('--extra <text>', 'Additional comments')
    .option('--submit', 'Submit via gh CLI instead of previewing', false)
    .action((cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const env = collectCliEnv();
      const body = buildCliIssueBody({
        description: cmdOpts.description,
        steps: cmdOpts.steps,
        expected: cmdOpts.expected,
        actual: cmdOpts.actual,
        extra: cmdOpts.extra,
        env,
      });
      const title = cmdOpts.title;

      if (cmdOpts.submit) {
        if (!checkGhAvailable()) {
          printError(
            createError(ErrorCodes.GH_NOT_FOUND, 'gh CLI is not installed or not in PATH', 'Install GitHub CLI: https://cli.github.com/ — or remove --submit to get a pre-filled URL instead'),
            opts.format,
          );
          process.exit(1);
        }
        try {
          const result = submitViaGh(CLI_REPO, title, body);
          if (opts.format === 'json') {
            output({ repo: CLI_REPO, title, issueNumber: result.issueNumber, url: result.url }, 'json');
          } else {
            console.log(`Issue created: ${result.url}`);
          }
        } catch (err: unknown) {
          printError(
            createError(ErrorCodes.GH_SUBMIT_FAILED, `Failed to create issue: ${err.message}`, 'Check your gh authentication with `gh auth status`'),
            opts.format,
          );
          process.exit(2);
        }
        return;
      }

      // Preview mode
      const url = buildIssueUrl(CLI_REPO, title, body);

      if (opts.format === 'json') {
        output({ repo: CLI_REPO, title, body, url }, 'json');
      } else if (opts.format === 'markdown') {
        console.log(body);
      } else {
        console.log(`Repository: ${CLI_REPO}`);
        console.log(`Title: ${title}`);
        console.log('');
        console.log('--- Issue Body ---');
        console.log(body);
        console.log('--- End ---');
        console.log('');
        console.log('To submit, re-run with --submit flag.');
      }
    });
}
