import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync } from 'node:fs';
import { loadMetadata } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { output } from '../output/formatter.js';
import { collectFiles, parseAntdImports } from '../utils/scan.js';

interface LintIssue {
  file: string;
  line: number;
  rule: string;
  severity: 'warning' | 'error';
  message: string;
}

/** Escape special RegExp characters in a string. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a map of deprecated props from metadata
function getDeprecatedProps(store: ReturnType<typeof loadMetadata>): Map<string, { prop: string; since: string; message: string }[]> {
  const result = new Map<string, { prop: string; since: string; message: string }[]>();
  for (const comp of store.components) {
    const deprecated = comp.props.filter((p) => p.deprecated);
    if (deprecated.length > 0) {
      result.set(comp.name, deprecated.map((p) => ({
        prop: p.name,
        since: typeof p.deprecated === 'string' ? p.deprecated : 'unknown',
        message: `\`${p.name}\` prop is deprecated${typeof p.deprecated === 'string' ? ` since ${p.deprecated}` : ''}`,
      })));
    }
  }
  return result;
}

/** Check if a pattern exists within `lookahead` lines starting from index `i`. */
function hasNearbyMatch(lines: string[], i: number, lookahead: number, pattern: RegExp): boolean {
  const end = Math.min(i + lookahead, lines.length);
  for (let j = i; j < end; j++) {
    if (pattern.test(lines[j])) return true;
  }
  return false;
}

function lintFile(
  filePath: string,
  deprecatedMap: Map<string, { prop: string; since: string; message: string }[]>,
  only?: string,
): LintIssue[] {
  const issues: LintIssue[] = [];
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const importedComponents = parseAntdImports(content);

  if (importedComponents.length === 0) return [];

  // Build per-component deprecated prop regexes once
  const deprecatedChecks: { compName: string; dep: { prop: string; since: string; message: string }; regex: RegExp }[] = [];
  if (!only || only === 'deprecated') {
    for (const compName of importedComponents) {
      const deprecations = deprecatedMap.get(compName);
      if (!deprecations) continue;
      for (const dep of deprecations) {
        deprecatedChecks.push({ compName, dep, regex: new RegExp(`\\b${escapeRegExp(dep.prop)}\\b\\s*[=({]`) });
      }
    }
  }

  const hasImage = importedComponents.includes('Image');
  const hasTable = importedComponents.includes('Table');
  const hasSelect = importedComponents.includes('Select') || importedComponents.includes('TreeSelect');

  // Single pass over all lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Deprecated prop checks
    for (const { compName, dep, regex } of deprecatedChecks) {
      if (regex.test(line)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'deprecated',
          severity: 'warning',
          message: `${compName} ${dep.message}`,
        });
      }
    }

    // Best practice checks
    if (!only || only === 'best-practice') {
      if (/style\s*=\s*\{\{/.test(line) && importedComponents.some((c) => line.includes(`<${c}`))) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'best-practice',
          severity: 'warning',
          message: 'Consider using `classNames` / `styles` props or Design Tokens instead of inline styles',
        });
      }
    }

    // Accessibility checks
    if (!only || only === 'a11y') {
      if (hasImage && /<Image\b/.test(line) && !hasNearbyMatch(lines, i, 5, /alt\s*=/)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'a11y',
          severity: 'warning',
          message: 'Image component is missing `alt` prop for accessibility',
        });
      }

      if (/<\w+Icon\b/.test(line) && /onClick\s*=/.test(line) && !hasNearbyMatch(lines, i, 3, /aria-label\s*=/)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'a11y',
          severity: 'warning',
          message: 'Clickable icon should have `aria-label` for screen readers',
        });
      }

      if (/Form\.Item\b/.test(line) && !hasNearbyMatch(lines, i, 5, /(?:label|aria-label|noStyle)\s*[=]/)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'a11y',
          severity: 'warning',
          message: 'Form.Item should have a `label` prop for accessibility',
        });
      }
    }

    // Performance checks
    if (!only || only === 'performance') {
      if (hasTable && /<Table\b/.test(line) && !hasNearbyMatch(lines, i, 10, /rowKey\s*=/)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'performance',
          severity: 'warning',
          message: 'Table should have explicit `rowKey` prop for optimal rendering performance',
        });
      }

      if (hasSelect && /<(?:Select|TreeSelect)\b/.test(line) && hasNearbyMatch(lines, i, 10, /virtual\s*=\s*\{?\s*false/)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'performance',
          severity: 'warning',
          message: 'Disabling `virtual` scroll on Select may cause performance issues with large datasets',
        });
      }

      if (/import\s+antd\b/.test(line) || /import\s+\*\s+as\s+\w+\s+from\s+['"]antd['"]/.test(line)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'performance',
          severity: 'error',
          message: 'Avoid wildcard import from antd. Use named imports: `import { Button } from \'antd\'`',
        });
      }
    }
  }

  return issues;
}

export function registerLintCommand(program: Command): void {
  program
    .command('lint [target]')
    .description('Check antd usage against best practices')
    .option('--only <category>', 'Only check specific category (deprecated, a11y, performance, best-practice)')
    .action((target: string | undefined, cmdOpts: { only?: string }) => {
      const opts = program.opts<GlobalOptions>();
      const targetPath = target || '.';
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadata(versionInfo.majorVersion);
      const deprecatedMap = getDeprecatedProps(store);

      const files = collectFiles(targetPath);
      const allIssues: LintIssue[] = [];

      for (const file of files) {
        allIssues.push(...lintFile(file, deprecatedMap, cmdOpts.only));
      }

      const summary = {
        total: allIssues.length,
        deprecated: allIssues.filter((i) => i.rule === 'deprecated').length,
        a11y: allIssues.filter((i) => i.rule === 'a11y').length,
        performance: allIssues.filter((i) => i.rule === 'performance').length,
        'best-practice': allIssues.filter((i) => i.rule === 'best-practice').length,
      };

      if (opts.format === 'json') {
        output({ issues: allIssues, summary }, 'json');
        return;
      }

      if (allIssues.length === 0) {
        console.log(`Scanned ${files.length} files. No issues found.`);
        return;
      }

      console.log(`Scanned ${files.length} files. Found ${allIssues.length} issues:\n`);

      for (const issue of allIssues) {
        const icon = issue.severity === 'error' ? '✗' : '⚠';
        console.log(`  ${icon} ${issue.file}:${issue.line} [${issue.rule}]`);
        console.log(`    ${issue.message}`);
      }

      console.log(`\nSummary: ${summary.deprecated} deprecated, ${summary.a11y} a11y, ${summary.performance} performance, ${summary['best-practice']} best-practice`);
    });
}
