import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { localize } from '../types.js';
import { loadMetadataForVersion, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { output } from '../output/formatter.js';

export function registerDocCommand(program: Command): void {
  program
    .command('doc <component>')
    .description('Output the full API documentation for a component in markdown')
    .action((component: string) => {
      const opts = program.opts<GlobalOptions>();
      const lang = opts.lang;
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadataForVersion(versionInfo.version);
      const comp = findComponent(store, component);

      if (!comp) {
        const names = getAllComponentNames(store);
        const suggestion = fuzzyMatch(component, names);
        const err = createError(
          ErrorCodes.COMPONENT_NOT_FOUND,
          `Component '${component}' not found`,
          suggestion ? `Did you mean '${suggestion}'?` : undefined,
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      const doc = localize(comp.doc, comp.docZh, lang);

      if (!doc) {
        const err = createError(
          'DOC_NOT_AVAILABLE',
          `Documentation not available for '${comp.name}'`,
          'Try upgrading to a newer version of the CLI',
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      if (opts.format === 'json') {
        output({ name: comp.name, doc }, 'json');
        return;
      }

      process.stdout.write(doc + '\n');
    });
}
