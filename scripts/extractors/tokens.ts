import fs from 'node:fs';
import path from 'node:path';
import type { TokenData } from '../../src/types.js';

interface TokenMetaEntry {
  source: string;
  token: string;
  type: string;
  desc: string;
  descEn: string;
  name: string;
  nameEn: string;
}

interface TokenMetaFile {
  global: Record<string, TokenMetaEntry[]>;
  components: Record<string, TokenMetaEntry[]>;
}

let cachedTokenMeta: TokenMetaFile | null = null;

function loadTokenMeta(antdDir: string): TokenMetaFile {
  if (cachedTokenMeta) return cachedTokenMeta;
  const tokenPath = path.join(antdDir, 'components', 'version', 'token-meta.json');
  if (!fs.existsSync(tokenPath)) {
    return { global: {}, components: {} };
  }
  cachedTokenMeta = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
  return cachedTokenMeta!;
}

function toTokenData(entry: TokenMetaEntry): TokenData {
  return {
    name: entry.token,
    type: entry.type,
    default: '',
    description: entry.descEn || entry.nameEn || '',
    descriptionZh: entry.desc || entry.name || '',
  };
}

/** Extract component-level design tokens */
export function extractTokens(antdDir: string, componentName: string): TokenData[] {
  const meta = loadTokenMeta(antdDir);
  const entries = meta.components[componentName];
  if (!entries) return [];
  return entries.map(toTokenData);
}

/** Extract global design tokens */
export function extractGlobalTokens(antdDir: string): TokenData[] {
  const meta = loadTokenMeta(antdDir);
  const tokens: TokenData[] = [];
  for (const [tokenName, entries] of Object.entries(meta.global)) {
    for (const entry of (Array.isArray(entries) ? entries : [entries])) {
      const data = toTokenData(entry);
      if (!data.name) data.name = tokenName;
      tokens.push(data);
    }
  }
  return tokens;
}

/** Reset cached token meta (for testing) */
export function resetTokenCache(): void {
  cachedTokenMeta = null;
}
