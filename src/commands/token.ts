import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { loadMetadataForVersion, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { formatTable, output } from '../output/formatter.js';

export function registerTokenCommand(program: Command): void {
  program
    .command('token [component]')
    .description('Query Design Tokens (global or component-level)')
    .action((component?: string) => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);

      if (versionInfo.majorVersion === 'v4') {
        const err = createError(
          ErrorCodes.UNSUPPORTED_VERSION_FEATURE,
          'Design Token system is not available in antd v4',
          'Upgrade to antd v5+ to use Design Tokens',
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      const store = loadMetadataForVersion(versionInfo.version);

      if (!component) {
        const globalTokens = store.globalTokens || [];
        if (globalTokens.length === 0) {
          console.log('No global token data available.');
          return;
        }

        if (opts.format === 'json') {
          output({ tokens: globalTokens }, 'json');
          return;
        }

        console.log('Global Design Tokens:');
        console.log('');
        const headers = ['Token', 'Type', 'Default', 'Description'];
        const rows = globalTokens.map((t) => [t.name, t.type, t.default, t.description || '-']);
        console.log(formatTable(headers, rows, opts.format === 'markdown' ? 'markdown' : 'text'));
        return;
      }

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

      const tokens = comp.tokens || [];
      if (tokens.length === 0) {
        console.log(`No component tokens available for ${comp.name}.`);
        return;
      }

      if (opts.format === 'json') {
        output({ component: comp.name, tokens }, 'json');
        return;
      }

      console.log(`${comp.name} Component Tokens:`);
      console.log('');
      const headers = ['Token', 'Type', 'Default'];
      const rows = tokens.map((t) => [t.name, t.type, t.default]);
      console.log(formatTable(headers, rows, opts.format === 'markdown' ? 'markdown' : 'text'));
    });
}
