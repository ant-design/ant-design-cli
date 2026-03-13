import type { Command } from 'commander';
import type { GlobalOptions, PropData } from '../types.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { loadMetadata, findComponent } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { output } from '../output/formatter.js';

interface LintIssue {
  file: string;
  line: number;
  rule: string;
  severity: 'warning' | 'error';
  message: string;
}

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.umi']);

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const stat = statSync(dir);
    if (stat.isFile()) return [dir];
  } catch {
    return [];
  }
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath));
      } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch { /* ignore */ }
  return files;
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

const ANTD_IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"]antd(?:\/[^'"]*)?['"]/g;

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

  // Find imported components
  const importedComponents: string[] = [];
  ANTD_IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANTD_IMPORT_RE.exec(content)) !== null) {
    const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
    importedComponents.push(...names);
  }

  if (importedComponents.length === 0) return [];

  // Check deprecated props
  if (!only || only === 'deprecated') {
    for (const compName of importedComponents) {
      const deprecations = deprecatedMap.get(compName);
      if (!deprecations) continue;

      for (const dep of deprecations) {
        // Simple regex search for prop usage: compName ... dep.prop or just dep.prop=
        const propRegex = new RegExp(`\\b${dep.prop}\\b\\s*[=({]`, 'g');
        for (let i = 0; i < lines.length; i++) {
          if (propRegex.test(lines[i])) {
            issues.push({
              file: filePath,
              line: i + 1,
              rule: 'deprecated',
              severity: 'warning',
              message: `${compName} ${dep.message}`,
            });
          }
          propRegex.lastIndex = 0;
        }
      }
    }
  }

  // Check best practices
  if (!only || only === 'best-practice') {
    for (let i = 0; i < lines.length; i++) {
      // Check for inline styles on antd components
      if (/style\s*=\s*\{\{/.test(lines[i]) && importedComponents.some((c) => lines[i].includes(`<${c}`))) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'best-practice',
          severity: 'warning',
          message: 'Consider using `classNames` / `styles` props or Design Tokens instead of inline styles',
        });
      }
    }
  }

  // Check accessibility
  if (!only || only === 'a11y') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for Image without alt
      if (importedComponents.includes('Image') && /<Image\b/.test(line) && !/alt\s*=/.test(line)) {
        // Look ahead a few lines for alt prop
        const nearby = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
        if (!/alt\s*=/.test(nearby)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'a11y',
            severity: 'warning',
            message: 'Image component is missing `alt` prop for accessibility',
          });
        }
      }

      // Check for Icon used as button without aria-label
      if (/<\w+Icon\b/.test(line) && /onClick\s*=/.test(line) && !/aria-label\s*=/.test(line)) {
        const nearby = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
        if (!/aria-label\s*=/.test(nearby)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'a11y',
            severity: 'warning',
            message: 'Clickable icon should have `aria-label` for screen readers',
          });
        }
      }

      // Check for Form.Item without label or aria-label
      if (/Form\.Item\b/.test(line) && !/label\s*=/.test(line) && !/aria-label\s*=/.test(line) && !/noStyle/.test(line)) {
        const nearby = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
        if (!/label\s*=/.test(nearby) && !/aria-label\s*=/.test(nearby) && !/noStyle/.test(nearby)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'a11y',
            severity: 'warning',
            message: 'Form.Item should have a `label` prop for accessibility',
          });
        }
      }
    }
  }

  // Check performance
  if (!only || only === 'performance') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for Table without rowKey
      if (importedComponents.includes('Table') && /<Table\b/.test(line)) {
        const nearby = lines.slice(i, Math.min(i + 10, lines.length)).join(' ');
        if (!/rowKey\s*=/.test(nearby)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'performance',
            severity: 'warning',
            message: 'Table should have explicit `rowKey` prop for optimal rendering performance',
          });
        }
      }

      // Check for Select/TreeSelect with large option set but no virtual
      if ((importedComponents.includes('Select') || importedComponents.includes('TreeSelect')) && /<(?:Select|TreeSelect)\b/.test(line)) {
        const nearby = lines.slice(i, Math.min(i + 10, lines.length)).join(' ');
        if (/virtual\s*=\s*\{?\s*false/.test(nearby)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'performance',
            severity: 'warning',
            message: 'Disabling `virtual` scroll on Select may cause performance issues with large datasets',
          });
        }
      }

      // Check for wildcard antd import
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
      const store = loadMetadata(versionInfo.majorVersion, opts.cache !== false);
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
