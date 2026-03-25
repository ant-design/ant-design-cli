import type { Command } from 'commander';
import type { GlobalOptions, CLIError, TokenData } from '../types.js';
import { localize } from '../types.js';
import { loadMetadataForVersion, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { formatTable, output } from '../output/formatter.js';

export interface GlobalTokensResult {
  tokens: TokenData[];
}

export interface ComponentTokensResult {
  component: string;
  tokens: TokenData[];
}

/**
 * Core function: get design tokens (global or component-level).
 * Returns token data or CLIError. Never writes to stdout.
 */
export function getTokens(
  component: string | undefined,
  opts: { lang: string; version: string },
): GlobalTokensResult | ComponentTokensResult | CLIError {
  const major = `v${opts.version.split('.')[0]}`;

  if (major === 'v4') {
    return createError(
      ErrorCodes.UNSUPPORTED_VERSION_FEATURE,
      'Design Token system is not available in antd v4',
      'Upgrade to antd v5+ to use Design Tokens',
    );
  }

  const store = loadMetadataForVersion(opts.version);

  if (!component) {
    const globalTokens = store.globalTokens || [];
    return { tokens: globalTokens };
  }

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

  const tokens = comp.tokens || [];
  return { component: comp.name, tokens };
}

export function registerTokenCommand(program: Command): void {
  program
    .command('token [component]')
    .description('Query Design Tokens (global or component-level)')
    .action((component?: string) => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const result = getTokens(component, {
        lang: opts.lang,
        version: versionInfo.version,
      });

      if ('error' in result) {
        printError(result, opts.format);
        process.exitCode = 1;
        return;
      }

      if ('component' in result) {
        // Component tokens
        if (result.tokens.length === 0) {
          console.log(`No component tokens available for ${result.component}.`);
          return;
        }
        if (opts.format === 'json') {
          output(result, 'json');
          return;
        }
        console.log(`${result.component} Component Tokens:`);
        console.log('');
        const headers = ['Token', 'Type', 'Default'];
        const rows = result.tokens.map((t) => [t.name, t.type, t.default]);
        console.log(formatTable(headers, rows, opts.format === 'markdown' ? 'markdown' : 'text'));
      } else {
        // Global tokens
        if (result.tokens.length === 0) {
          console.log('No global token data available.');
          return;
        }
        if (opts.format === 'json') {
          output(result, 'json');
          return;
        }
        console.log('Global Design Tokens:');
        console.log('');
        const headers = ['Token', 'Type', 'Default', 'Description'];
        const rows = result.tokens.map((t) => [
          t.name,
          t.type,
          t.default,
          localize(t.description, t.descriptionZh, opts.lang) || '-',
        ]);
        console.log(formatTable(headers, rows, opts.format === 'markdown' ? 'markdown' : 'text'));
      }
    });
}
