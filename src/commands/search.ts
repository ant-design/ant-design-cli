import type { Command } from 'commander';
import type { GlobalOptions, ComponentData } from '../types.js';
import { loadMetadata } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { output } from '../output/formatter.js';

interface SearchResult {
  type: string;
  name: string;
  section: string;
  match: string;
  score: number;
}

function scoreMatch(text: string, keyword: string): number {
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  if (lower === kw) return 1.0;
  if (lower.includes(kw)) {
    // Prefer shorter matches (more relevant)
    return 0.7 + 0.2 * (kw.length / lower.length);
  }
  // Word-level match
  const words = kw.split(/\s+/);
  const matchedWords = words.filter((w) => lower.includes(w));
  if (matchedWords.length > 0) {
    return 0.4 * (matchedWords.length / words.length);
  }
  return 0;
}

function searchComponent(comp: ComponentData, keyword: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Search description
  const descScore = scoreMatch(comp.description, keyword);
  if (descScore > 0) {
    results.push({
      type: 'component',
      name: comp.name,
      section: 'description',
      match: comp.description,
      score: descScore,
    });
  }

  // Search whenToUse
  if (comp.whenToUse) {
    const wtuScore = scoreMatch(comp.whenToUse, keyword);
    if (wtuScore > 0) {
      results.push({
        type: 'component',
        name: comp.name,
        section: 'whenToUse',
        match: comp.whenToUse,
        score: wtuScore,
      });
    }
  }

  // Search props
  for (const prop of comp.props) {
    const nameScore = scoreMatch(prop.name, keyword);
    const descScore2 = prop.description ? scoreMatch(prop.description, keyword) : 0;
    const best = Math.max(nameScore, descScore2);
    if (best > 0) {
      results.push({
        type: 'component',
        name: comp.name,
        section: 'props',
        match: `${prop.name} — ${prop.description || prop.type}`,
        score: best,
      });
    }
  }

  // Search demos
  if (comp.demos) {
    for (const demo of comp.demos) {
      const titleScore = scoreMatch(demo.title, keyword);
      const demoDescScore = scoreMatch(demo.description, keyword);
      const best = Math.max(titleScore, demoDescScore);
      if (best > 0) {
        results.push({
          type: 'component',
          name: comp.name,
          section: 'demo',
          match: `${demo.title} — ${demo.description}`,
          score: best,
        });
      }
    }
  }

  // Search FAQ
  if (comp.faq) {
    for (const faq of comp.faq) {
      const qScore = scoreMatch(faq.question, keyword);
      const aScore = scoreMatch(faq.answer, keyword);
      const best = Math.max(qScore, aScore);
      if (best > 0) {
        results.push({
          type: 'component',
          name: comp.name,
          section: 'FAQ',
          match: faq.question,
          score: best,
        });
      }
    }
  }

  return results;
}

export function registerSearchCommand(program: Command): void {
  program
    .command('search <keyword>')
    .description('Full-text search across component docs, demos, FAQ, and changelog')
    .action((keyword: string) => {
      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadata(versionInfo.majorVersion, opts.cache !== false);

      let results: SearchResult[] = [];
      for (const comp of store.components) {
        results.push(...searchComponent(comp, keyword));
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      // Limit results
      results = results.slice(0, 20);

      if (opts.format === 'json') {
        output({ query: keyword, results }, 'json');
        return;
      }

      if (results.length === 0) {
        console.log(`No results found for "${keyword}".`);
        return;
      }

      console.log(`Search results for "${keyword}":`);
      console.log('');
      for (const r of results) {
        const score = (r.score * 100).toFixed(0);
        console.log(`  [${score}%] ${r.name} (${r.section})`);
        console.log(`    ${r.match}`);
      }
    });
}
