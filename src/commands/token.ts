import type { Command } from 'commander';
import type { GlobalOptions, CLIError, TokenData } from '../types.js';
import { loadMetadataForVersion, resolveComponent } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, ErrorCodes } from '../output/error.js';
import { outputTokens, type GlobalTokensResult, type ComponentTokensResult } from '../output/formatter.js';

// Re-export types for external use
export type { GlobalTokensResult, ComponentTokensResult };

/**
 * Core function: get design tokens (global or component-level).
 * Returns token data or CLIError. Never writes to stdout.
 */
export function getTokens(
  component: string | undefined,
  opts: { lang: string; version: string },
): GlobalTokensResult | ComponentTokensResult | CLIError {
  const major = `v${opts.version.split('.')[0]}`;

  if (major === 'v3') {
    return createError(
      ErrorCodes.UNSUPPORTED_VERSION_FEATURE,
      'Design Tokens are only available in antd v5+',
      'v3 uses Less variables for theming. See: https://3x.ant.design/docs/react/customize-theme',
    );
  }

  if (major === 'v4') {
    return createError(
      ErrorCodes.UNSUPPORTED_VERSION_FEATURE,
      'Design Token system is not available in antd v4',
      'Upgrade to antd v5+ to use Design Tokens',
    );
  }

  if (!component) {
    const store = loadMetadataForVersion(opts.version);
    const globalTokens = store.globalTokens || [];
    return { tokens: globalTokens };
  }

  const resolved = resolveComponent(component, opts.version);
  if ('error' in resolved) return resolved;
  const { comp } = resolved;

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

      outputTokens(result, { format: opts.format, lang: opts.lang });
    });
}
