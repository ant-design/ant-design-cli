import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { loadMetadata, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { output } from '../output/formatter.js';

export function registerDemoCommand(program: Command): void {
  program
    .command('demo <component> [name]')
    .description('Get demo source code for a component')
    .action((component: string, name?: string) => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadata(versionInfo.majorVersion, opts.cache !== false);
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

      const demos = comp.demos || [];

      if (!name) {
        // List all demos
        if (opts.format === 'json') {
          output(
            {
              component: comp.name,
              demos: demos.map((d) => ({
                name: d.name,
                title: d.title,
                description: d.description,
              })),
            },
            'json',
          );
        } else {
          console.log(`${comp.name} Demos:`);
          console.log('');
          for (const demo of demos) {
            console.log(`  ${demo.name} — ${demo.title}`);
            console.log(`    ${demo.description}`);
          }
          if (demos.length === 0) {
            console.log('  No demos available.');
          }
        }
        return;
      }

      // Find specific demo
      const demo = demos.find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (!demo) {
        const demoNames = demos.map((d) => d.name);
        const suggestion = fuzzyMatch(name, demoNames);
        const err = createError(
          ErrorCodes.DEMO_NOT_FOUND,
          `Demo '${name}' not found for ${comp.name}`,
          suggestion
            ? `Did you mean '${suggestion}'?`
            : `Available demos: ${demoNames.join(', ') || 'none'}`,
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      if (opts.format === 'json') {
        output(
          {
            component: comp.name,
            demo: demo.name,
            title: demo.title,
            description: demo.description,
            code: demo.code,
          },
          'json',
        );
      } else {
        console.log(`${comp.name} / ${demo.title}`);
        console.log(`${demo.description}`);
        console.log('');
        console.log(demo.code);
      }
    });
}
