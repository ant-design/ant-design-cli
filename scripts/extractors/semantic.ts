import fs from 'node:fs';
import path from 'node:path';
import type { SemanticKey } from '../../src/types.js';

/** Extract semantic keys from _semantic.tsx file using regex */
export function extractSemantic(antdDir: string, dirName: string): SemanticKey[] {
  const semanticPath = path.join(antdDir, 'components', dirName, 'demo', '_semantic.tsx');
  if (!fs.existsSync(semanticPath)) return [];

  const content = fs.readFileSync(semanticPath, 'utf-8');

  // Extract locale definitions for descriptions
  const localesMatch = content.match(/const locales\s*=\s*\{([\s\S]*?)\n\};/);
  const enDescs = new Map<string, string>();
  const zhDescs = new Map<string, string>();

  if (localesMatch) {
    const localesBlock = localesMatch[1];
    // Parse en block
    const enBlock = localesBlock.match(/en:\s*\{([\s\S]*?)\}/);
    if (enBlock) {
      const entries = enBlock[1].matchAll(/(\w+):\s*['"`]([\s\S]*?)['"`]/g);
      for (const entry of entries) {
        enDescs.set(entry[1], entry[2]);
      }
    }
    // Parse cn/zh block
    const zhBlock = localesBlock.match(/cn:\s*\{([\s\S]*?)\}/);
    if (zhBlock) {
      const entries = zhBlock[1].matchAll(/(\w+):\s*['"`]([\s\S]*?)['"`]/g);
      for (const entry of entries) {
        zhDescs.set(entry[1], entry[2]);
      }
    }
  }

  // Extract semantics array: { name: 'root', desc: locale.root, version: '6.0.0' }
  const semantics: SemanticKey[] = [];
  const semanticsRegex = /\{\s*name:\s*['"`](\w+)['"`]\s*,\s*desc:\s*locale\.(\w+)/g;
  let match;

  while ((match = semanticsRegex.exec(content)) !== null) {
    const name = match[1];
    const localeKey = match[2];
    semantics.push({
      key: name,
      description: enDescs.get(localeKey) || '',
      descriptionZh: zhDescs.get(localeKey) || '',
    });
  }

  return semantics;
}
