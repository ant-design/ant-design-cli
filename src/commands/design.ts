import type { Command } from 'commander';
import type { GlobalOptions, CLIError } from '../types.js';
import { loadDesignDoc } from '../data/loader.js';
import { createError, printError, ErrorCodes } from '../output/error.js';
import { output } from '../output/formatter.js';

export interface DesignDoc {
  doc: string;
}

/**
 * Core function: get the antd design-language document (design.md).
 * Returns { doc } or CLIError. Never writes to stdout.
 *
 * The document follows the google-labs-code/design.md spec — YAML front-matter
 * with colors/typography/rounded/spacing/components, plus prose sections — so AI
 * design tools (Figma Make, Stitch, etc.) can consume antd's design language.
 */
export function getDesign(): DesignDoc | CLIError {
  const doc = loadDesignDoc();

  if (doc === null) {
    return createError(
      ErrorCodes.DOC_NOT_AVAILABLE,
      'design.md is not available in this CLI build',
      'Try upgrading to a newer version of the CLI',
    );
  }

  return { doc };
}

export function registerDesignCommand(program: Command): void {
  program
    .command('design')
    .description('Output the antd design-language document (design.md) for AI design tools')
    .action(() => {
      const opts = program.opts<GlobalOptions>();
      const result = getDesign();

      if ('error' in result) {
        printError(result, opts.format);
        process.exitCode = 1;
        return;
      }

      if (opts.format === 'json') {
        output({ doc: result.doc }, 'json');
        return;
      }

      process.stdout.write(result.doc + '\n');
    });
}
