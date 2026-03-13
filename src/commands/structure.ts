import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { loadMetadata, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';
import { output } from '../output/formatter.js';

export function registerSemanticCommand(program: Command): void {
  program
    .command('semantic <component>')
    .description('Query the semantic customization structure of a component')
    .action((component: string) => {
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

      const structure = comp.semanticStructure || [];
      if (structure.length === 0) {
        console.log(`No semantic structure data available for ${comp.name}.`);
        return;
      }

      if (opts.format === 'json') {
        output({ name: comp.name, semanticStructure: structure }, 'json');
        return;
      }

      console.log(`${comp.name} Semantic Structure:`);
      for (let i = 0; i < structure.length; i++) {
        const prefix = i === structure.length - 1 ? '└──' : '├──';
        console.log(`${prefix} ${structure[i].key}         # ${structure[i].description}`);
      }
      console.log('');
      console.log('Usage:');
      console.log(`  <${comp.name} classNames={{ ${structure[0]?.key}: 'my-${structure[0]?.key}' }} />`);
      console.log(`  <${comp.name} styles={{ ${structure[0]?.key}: { background: '#fff' } }} />`);
    });
}
