import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { loadMetadata, findComponent, getAllComponentNames } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { output } from '../output/formatter.js';
import { createError, printError, fuzzyMatch, ErrorCodes } from '../output/error.js';

// Pre-computed bundle size estimates (will come from @ant-design/metadata in the future)
const BUNDLE_SIZE_DATA: Record<string, { raw: string; gzip: string; dependencies: string[] }> = {
  Button: { raw: '12.5 kB', gzip: '4.2 kB', dependencies: ['rc-util', '@ant-design/cssinjs'] },
  Table: { raw: '156.8 kB', gzip: '45.6 kB', dependencies: ['rc-table', 'rc-util', 'rc-virtual-list'] },
  Select: { raw: '68.2 kB', gzip: '20.1 kB', dependencies: ['rc-select', 'rc-util', 'rc-virtual-list'] },
  Input: { raw: '18.3 kB', gzip: '6.1 kB', dependencies: ['rc-input', 'rc-util'] },
  Form: { raw: '42.6 kB', gzip: '13.8 kB', dependencies: ['rc-field-form', 'rc-util', 'async-validator'] },
  Modal: { raw: '28.4 kB', gzip: '9.2 kB', dependencies: ['rc-dialog', 'rc-util', 'rc-motion'] },
  Space: { raw: '4.2 kB', gzip: '1.8 kB', dependencies: ['rc-util'] },
  Flex: { raw: '3.1 kB', gzip: '1.2 kB', dependencies: ['rc-util'] },
  Grid: { raw: '8.5 kB', gzip: '3.1 kB', dependencies: ['rc-util'] },
};

export function registerBundleImpactCommand(program: Command): void {
  program
    .command('bundle-impact <component>')
    .description('Analyze bundle size impact of importing a component')
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

      const sizeData = BUNDLE_SIZE_DATA[comp.name];

      if (!sizeData) {
        console.log(`Bundle size data for ${comp.name} is not yet available.`);
        console.log('This data will be pre-computed during antd release CI.');
        return;
      }

      const result = {
        component: comp.name,
        size: { raw: sizeData.raw, gzip: sizeData.gzip },
        dependencies: sizeData.dependencies,
        subComponents: comp.subComponents?.map((sub) => ({
          name: sub,
          additionalSize: { raw: 'included', gzip: 'included' },
        })),
      };

      if (opts.format === 'json') {
        output(result, 'json');
        return;
      }

      console.log(`${comp.name} Bundle Impact:\n`);
      console.log(`  Size: ${sizeData.raw} (${sizeData.gzip} gzip)`);
      console.log(`  Dependencies: ${sizeData.dependencies.join(', ')}`);
      if (comp.subComponents && comp.subComponents.length > 0) {
        console.log(`  Sub-components: ${comp.subComponents.join(', ')} (included in bundle)`);
      }
    });
}
