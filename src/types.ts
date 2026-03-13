export interface PropData {
  name: string;
  type: string;
  default: string;
  description?: string;
  descriptionZh?: string;
  since?: string;
  deprecated?: boolean | string;
  required?: boolean;
}

export interface DemoData {
  name: string;
  title: string;
  titleZh?: string;
  description: string;
  descriptionZh?: string;
  code: string;
}

export interface TokenData {
  name: string;
  type: string;
  default: string;
  description?: string;
  descriptionZh?: string;
}

export interface SemanticKey {
  key: string;
  description: string;
  descriptionZh?: string;
}

export interface ComponentData {
  name: string;
  category: string;
  categoryZh?: string;
  description: string;
  descriptionZh?: string;
  whenToUse?: string;
  whenToUseZh?: string;
  props: PropData[];
  methods?: { name: string; description: string; type: string }[];
  demos?: DemoData[];
  tokens?: TokenData[];
  semanticStructure?: SemanticKey[];
  related?: string[];
  faq?: { question: string; answer: string }[];
  subComponents?: string[];
}

/** Pick the right text based on language. Falls back to English. */
export function localize(en: string | undefined, zh: string | undefined, lang: string): string {
  if (lang === 'zh' && zh) return zh;
  return en || '';
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    component: string;
    type: 'feature' | 'fix' | 'style' | 'deprecation' | 'breaking' | 'other';
    description: string;
  }[];
}

export interface MetadataStore {
  version: string;
  majorVersion: string;
  components: ComponentData[];
  globalTokens?: TokenData[];
  changelog?: ChangelogEntry[];
}

export type OutputFormat = 'json' | 'text' | 'markdown';

export interface GlobalOptions {
  format: OutputFormat;
  version?: string;
  lang: 'en' | 'zh';
  cache: boolean;
  detail: boolean;
}

export interface CLIError {
  error: true;
  code: string;
  message: string;
  suggestion?: string;
}
