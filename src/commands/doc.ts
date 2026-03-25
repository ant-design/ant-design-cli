import type { Command } from 'commander';
import type { GlobalOptions, CLIError } from '../types.js';
import { localize } from '../types.js';
import { loadMetadataForVersion, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { output } from '../output/formatter.js';

export interface ComponentDoc {
  name: string;
  doc: string;
}

/**
 * Core function: get component documentation in markdown.
 * Returns { name, doc } or CLIError. Never writes to stdout.
 */
export function getComponentDoc(
  component: string,
  opts: { lang: string; version: string },
): ComponentDoc | CLIError {
  const store = loadMetadataForVersion(opts.version);
  const comp = findComponent(store, component);

  if (!comp) {
    const names = getAllComponentNames(store);
    const suggestion = fuzzyMatch(component, names);
    return createError(
      ErrorCodes.COMPONENT_NOT_FOUND,
      `Component '${component}' not found`,
      suggestion ? `Did you mean '${suggestion}'?` : undefined,
    );
  }

  const doc = localize(comp.doc, comp.docZh, opts.lang);

  if (!doc) {
    return createError(
      'DOC_NOT_AVAILABLE',
      `Documentation not available for '${comp.name}'`,
      'Try upgrading to a newer version of the CLI',
    );
  }

  return { name: comp.name, doc };
}

export function registerDocCommand(program: Command): void {
  program
    .command('doc <component>')
    .description('Output the full API documentation for a component in markdown')
    .action((component: string) => {
      const opts = program.opts<GlobalOptions>();
      const lang = opts.lang;
      const versionInfo = detectVersion(opts.version);
      const result = getComponentDoc(component, {
        lang,
        version: versionInfo.version,
      });

      if ('error' in result) {
        printError(result, opts.format);
        process.exitCode = 1;
        return;
      }

      if (opts.format === 'json') {
        output({ name: result.name, doc: result.doc }, 'json');
        return;
      }

      process.stdout.write(result.doc + '\n');
    });
}
