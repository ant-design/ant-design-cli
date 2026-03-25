import type { Command } from 'commander';
import type { GlobalOptions, CLIError } from '../types.js';
import { resolveComponent } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { output } from '../output/formatter.js';

export interface DemoListResult {
  component: string;
  demos: { name: string; title: string; description: string }[];
}

export interface DemoResult {
  component: string;
  demo: string;
  title: string;
  description: string;
  code: string;
}

/**
 * Core function: get component demos.
 * If name is omitted, returns list of all demos.
 * If name is provided, returns specific demo with code.
 * Returns data or CLIError. Never writes to stdout.
 */
export function getComponentDemo(
  component: string,
  opts: { version: string; name?: string },
): DemoListResult | DemoResult | CLIError {
  const resolved = resolveComponent(component, opts.version);
  if ('error' in resolved) return resolved;
  const { comp } = resolved;

  const demos = comp.demos || [];

  if (!opts.name) {
    return {
      component: comp.name,
      demos: demos.map((d) => ({
        name: d.name,
        title: d.title,
        description: d.description,
      })),
    };
  }

  const demo = demos.find((d) => d.name.toLowerCase() === opts.name!.toLowerCase());
  if (!demo) {
    const demoNames = demos.map((d) => d.name);
    const suggestion = fuzzyMatch(opts.name, demoNames);
    return createError(
      ErrorCodes.DEMO_NOT_FOUND,
      `Demo '${opts.name}' not found for ${comp.name}`,
      suggestion
        ? `Did you mean '${suggestion}'?`
        : `Available demos: ${demoNames.join(', ') || 'none'}`,
    );
  }

  return {
    component: comp.name,
    demo: demo.name,
    title: demo.title,
    description: demo.description,
    code: demo.code,
  };
}

export function registerDemoCommand(program: Command): void {
  program
    .command('demo <component> [name]')
    .description('Get demo source code for a component')
    .action((component: string, name?: string) => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const result = getComponentDemo(component, {
        version: versionInfo.version,
        name,
      });

      if ('error' in result) {
        printError(result, opts.format);
        process.exitCode = 1;
        return;
      }

      if ('code' in result) {
        // Single demo result
        if (opts.format === 'json') {
          output(result, 'json');
        } else {
          console.log(`${result.component} / ${result.title}`);
          console.log(`${result.description}`);
          console.log('');
          console.log(result.code);
        }
      } else {
        // Demo list result
        if (opts.format === 'json') {
          output(result, 'json');
        } else {
          console.log(`${result.component} Demos:`);
          console.log('');
          for (const demo of result.demos) {
            console.log(`  ${demo.name} — ${demo.title}`);
            console.log(`    ${demo.description}`);
          }
          if (result.demos.length === 0) {
            console.log('  No demos available.');
          }
        }
      }
    });
}
