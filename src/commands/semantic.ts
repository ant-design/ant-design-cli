import type { Command } from 'commander';
import type { GlobalOptions, CLIError, SemanticKey } from '../types.js';
import { localize } from '../types.js';
import { resolveComponent } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { createError, printError, ErrorCodes } from '../output/error.js';
import { formatTable, output } from '../output/formatter.js';

export interface SemanticStructureResult {
  name: string;
  semanticStructure: SemanticKey[];
}

/**
 * Core function: get semantic customization structure of a component.
 * Returns data or CLIError. Never writes to stdout.
 */
export function getSemanticStructure(
  component: string,
  opts: { version: string },
): SemanticStructureResult | CLIError {
  const major = `v${opts.version.split('.')[0]}`;

  if (major === 'v3' || major === 'v4') {
    return createError(
      ErrorCodes.UNSUPPORTED_VERSION_FEATURE,
      'Semantic structure is only available in antd v5+',
      'The classNames/styles customization API was introduced in antd v5. See: https://ant.design/docs/react/customize-theme#use-classnames-and-styles',
    );
  }

  const resolved = resolveComponent(component, opts.version);
  if ('error' in resolved) return resolved;
  const { comp } = resolved;

  const structure = comp.semanticStructure || [];
  return { name: comp.name, semanticStructure: structure };
}

export function registerSemanticCommand(program: Command): void {
  program
    .command('semantic <component>')
    .description('Query the semantic customization structure of a component')
    .action((component: string) => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const result = getSemanticStructure(component, {
        version: versionInfo.version,
      });

      if ('error' in result) {
        printError(result, opts.format);
        process.exitCode = 1;
        return;
      }

      if (result.semanticStructure.length === 0) {
        console.log(localize(
          `No semantic structure data available for ${result.name}.`,
          `${result.name} 没有可用的语义结构数据。`,
          opts.lang,
        ));
        return;
      }

      if (opts.format === 'json') {
        output(result, 'json');
        return;
      }

      const structure = result.semanticStructure;

      if (opts.format === 'markdown') {
        console.log(`## ${localize(`${result.name} Semantic Structure`, `${result.name} 语义结构`, opts.lang)}`);
        console.log('');
        const headers = [localize('Key', '键名', opts.lang), localize('Description', '描述', opts.lang)];
        const rows = structure.map((s) => [
          s.key,
          localize(s.description, s.descriptionZh, opts.lang),
        ]);
        console.log(formatTable(headers, rows, 'markdown'));
        console.log('');
        console.log(`**${localize('Usage', '用法', opts.lang)}:**`);
        console.log('```tsx');
        console.log(`<${result.name} classNames={{ ${structure[0]?.key}: 'my-${structure[0]?.key}' }} />`);
        console.log(`<${result.name} styles={{ ${structure[0]?.key}: { background: '#fff' } }} />`);
        console.log('```');
        return;
      }

      console.log(localize(
        `${result.name} Semantic Structure:`,
        `${result.name} 语义结构：`,
        opts.lang,
      ));
      for (let i = 0; i < structure.length; i++) {
        const prefix = i === structure.length - 1 ? '└──' : '├──';
        console.log(`${prefix} ${structure[i].key}         # ${localize(structure[i].description, structure[i].descriptionZh, opts.lang)}`);
      }
      console.log('');
      console.log(localize('Usage:', '用法：', opts.lang));
      console.log(`  <${result.name} classNames={{ ${structure[0]?.key}: 'my-${structure[0]?.key}' }} />`);
      console.log(`  <${result.name} styles={{ ${structure[0]?.key}: { background: '#fff' } }} />`);
    });
}
