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

interface BugCommandConfig {
  repo: string;
  buildBody: (cmdOpts: Record<string, unknown>, version?: string) => string;
}

/**
 * Shared action handler for `bug` and `bug-cli` commands.
 * Eliminates ~60 lines of duplicated submit/preview logic.
 */
function createBugAction(program: Command, config: BugCommandConfig) {
  return (cmdOpts: Record<string, unknown>) => {
    const opts = program.opts<GlobalOptions>();
    const title = cmdOpts.title as string;

    if (!title) {
      printError(
        createError(ErrorCodes.TITLE_REQUIRED, '--title is required', 'Provide --title <title>'),
        opts.format,
      );
      process.exitCode = 1;
      return;
    }

    const body = config.buildBody(cmdOpts, opts.version);

    if (cmdOpts.submit) {
      if (!checkGhAvailable()) {
        printError(
          createError(ErrorCodes.GH_NOT_FOUND, 'gh CLI is not installed or not in PATH', 'Install GitHub CLI: https://cli.github.com/ — or remove --submit to get a pre-filled URL instead'),
          opts.format,
        );
        process.exitCode = 1;
        return;
      }
      try {
        const result = submitViaGh(config.repo, title, body);
        if (opts.format === 'json') {
          output({ repo: config.repo, title, issueNumber: result.issueNumber, url: result.url }, 'json');
        } else {
          console.log(`Issue created: ${result.url}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printError(
          createError(ErrorCodes.GH_SUBMIT_FAILED, `Failed to create issue: ${message}`, 'Check your gh authentication with `gh auth status`'),
          opts.format,
        );
        process.exitCode = 2;
        return;
      }
      return;
    }

    // Preview mode
    const url = buildIssueUrl(config.repo, title, body);

    if (opts.format === 'json') {
      output({ repo: config.repo, title, body, url }, 'json');
    } else if (opts.format === 'markdown') {
      console.log(body);
    } else {
      console.log(`Repository: ${config.repo}`);
      console.log(`Title: ${title}`);
      console.log('');
      console.log('--- Issue Body ---');
      console.log(body);
      console.log('--- End ---');
      console.log('');
      console.log('To submit, re-run with --submit flag.');
    }
  };
}

export function registerBugCommand(program: Command): void {
  program
    .command('bug')
    .description('Report a bug to the antd repository')
    .option('--title <title>', 'Issue title')
    .option('--reproduction <url>', 'Reproduction link')
    .option('--steps <text>', 'Steps to reproduce')
    .option('--expected <text>', 'Expected behavior')
    .option('--actual <text>', 'Actual behavior')
    .option('--extra <text>', 'Additional comments')
    .option('--submit', 'Submit via gh CLI instead of previewing', false)
    .action(createBugAction(program, {
      repo: ANTD_REPO,
      buildBody: (cmdOpts, version) => buildAntdIssueBody({
        reproduction: cmdOpts.reproduction as string | undefined,
        steps: cmdOpts.steps as string | undefined,
        expected: cmdOpts.expected as string | undefined,
        actual: cmdOpts.actual as string | undefined,
        extra: cmdOpts.extra as string | undefined,
        env: collectAntdEnv(process.cwd(), version),
      }),
    }));
}

export function registerBugCliCommand(program: Command): void {
  program
    .command('bug-cli')
    .description('Report a bug to the ant-design-cli repository')
    .option('--title <title>', 'Issue title')
    .option('--description <desc>', 'Problem description')
    .option('--steps <text>', 'Steps to reproduce')
    .option('--expected <text>', 'Expected behavior')
    .option('--actual <text>', 'Actual behavior')
    .option('--extra <text>', 'Additional comments')
    .option('--submit', 'Submit via gh CLI instead of previewing', false)
    .action(createBugAction(program, {
      repo: CLI_REPO,
      buildBody: (cmdOpts) => buildCliIssueBody({
        description: cmdOpts.description as string | undefined,
        steps: cmdOpts.steps as string | undefined,
        expected: cmdOpts.expected as string | undefined,
        actual: cmdOpts.actual as string | undefined,
        extra: cmdOpts.extra as string | undefined,
        env: collectCliEnv(),
      }),
    }));
}