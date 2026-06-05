import type { Command } from 'commander';
import type { GlobalOptions, CLIError } from '../types.js';
import { loadDesignDoc } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, ErrorCodes } from '../output/error.js';
import { output } from '../output/formatter.js';

export interface DesignDoc {
  doc: string;
}

/**
 * Core function: get the antd design-language document (design.md) for a version.
 * Returns { doc } or CLIError. Never writes to stdout.
 *
 * The document follows the google-labs-code/design.md spec — YAML front-matter
 * with colors/typography/rounded/spacing/components, plus prose sections — so AI
 * design tools (Figma Make, Stitch, etc.) can consume antd's design language.
 *
 * It is major-grained: antd rewrites it only across major releases, so we resolve
 * the document by major version. A design.md is currently published only for v6;
 * other majors return UNSUPPORTED_VERSION_FEATURE.
 */
export function getDesign(opts: { version: string }): DesignDoc | CLIError {
  const major = `v${opts.version.split('.')[0]}`;
  const doc = loadDesignDoc(major);

  if (doc === null) {
    return createError(
      ErrorCodes.UNSUPPORTED_VERSION_FEATURE,
      `design.md is not available for antd ${major}`,
      'A design.md is currently published only for antd v6. Use --version 6.x or omit it.',
    );
  }

  return { doc };
}

export function registerDesignCommand(program: Command): void {
  program
    .command('design.md')
    .description('Output the antd design-language document (design.md) for AI design tools')
    .action(() => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const result = getDesign({ version: versionInfo.version });

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
