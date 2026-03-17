#!/usr/bin/env node

/**
 * Extract antd component metadata from source into a MetadataStore JSON file.
 *
 * Usage:
 *   npx tsx scripts/extract.ts --antd-dir ~/Projects/ant-design --output data/v6.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { extractComponents } from './extractors/components.js';
import { extractProps } from './extractors/props.js';
import { extractDemos } from './extractors/demos.js';
import { extractTokens, extractGlobalTokens, resetTokenCache } from './extractors/tokens.js';
import { extractSemantic } from './extractors/semantic.js';
import { extractChangelog } from './extractors/changelog.js';
import { extractFaq } from './extractors/faq.js';
import type { MetadataStore, ComponentData } from '../src/types.js';

function parseArgs(args: string[]): { antdDir: string; output: string } {
  let antdDir = '';
  let output = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--antd-dir' && args[i + 1]) {
      antdDir = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[++i];
    }
  }

  if (!antdDir) {
    console.error('Usage: tsx scripts/extract.ts --antd-dir <path> --output <file>');
    process.exit(1);
  }

  // Resolve paths
  antdDir = path.resolve(antdDir);
  output = output ? path.resolve(output) : '';

  // Verify antd directory exists
  if (!fs.existsSync(path.join(antdDir, 'components'))) {
    console.error(`Error: ${antdDir}/components not found. Is this an antd source directory?`);
    process.exit(1);
  }

  return { antdDir, output };
}

function getAntdVersion(antdDir: string): string {
  const pkgPath = path.join(antdDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '';
  }
  return '';
}

function getMajorVersion(version: string): string {
  const major = version.split('.')[0];
  return `v${major}`;
}

function main() {
  const { antdDir, output } = parseArgs(process.argv.slice(2));
  const version = getAntdVersion(antdDir);
  const majorVersion = getMajorVersion(version);

  console.log(`Extracting metadata from ${antdDir} (antd v${version})...`);

  // Reset caches
  resetTokenCache();

  // 1. Discover all components
  const componentMetas = extractComponents(antdDir);
  console.log(`Found ${componentMetas.length} components`);

  // 2. Build full ComponentData for each
  const components: ComponentData[] = componentMetas.map((meta) => {
    const props = extractProps(antdDir, meta.dirName);
    const demos = extractDemos(antdDir, meta.dirName);
    const tokens = extractTokens(antdDir, meta.name);
    const semantic = extractSemantic(antdDir, meta.dirName);
    const faq = extractFaq(antdDir, meta.dirName);

    const component: ComponentData = {
      name: meta.name,
      nameZh: meta.nameZh || undefined,
      category: meta.category,
      categoryZh: meta.categoryZh || undefined,
      description: meta.description,
      descriptionZh: meta.descriptionZh || undefined,
      whenToUse: meta.whenToUse || undefined,
      whenToUseZh: meta.whenToUseZh || undefined,
      props,
      demos: demos.length > 0 ? demos : undefined,
      tokens: tokens.length > 0 ? tokens : undefined,
      semanticStructure: semantic.length > 0 ? semantic : undefined,
      faq: faq.length > 0 ? faq : undefined,
      subComponents: meta.subComponents.length > 0 ? meta.subComponents : undefined,
    };

    return component;
  });

  // 3. Extract global tokens
  const globalTokens = extractGlobalTokens(antdDir);

  // 4. Extract changelog
  const changelog = extractChangelog(antdDir);

  // 5. Build final MetadataStore
  const store: MetadataStore = {
    version,
    majorVersion,
    components,
    globalTokens: globalTokens.length > 0 ? globalTokens : undefined,
    changelog: changelog.length > 0 ? changelog : undefined,
  };

  // 6. Output
  const json = JSON.stringify(store, null, 2);

  if (output) {
    // Ensure output directory exists
    const dir = path.dirname(output);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(output, json + '\n');
    console.log(`Written to ${output}`);

    // Print stats
    console.log(`  Components: ${components.length}`);
    console.log(`  Global tokens: ${globalTokens.length}`);
    console.log(`  Changelog entries: ${changelog.length}`);
    const totalProps = components.reduce((sum, c) => sum + c.props.length, 0);
    const totalDemos = components.reduce((sum, c) => sum + (c.demos?.length || 0), 0);
    console.log(`  Total props: ${totalProps}`);
    console.log(`  Total demos: ${totalDemos}`);
  } else {
    process.stdout.write(json + '\n');
  }
}

main();
