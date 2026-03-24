import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync } from 'node:fs';
import { loadMetadataForVersion } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { output } from '../output/formatter.js';
import { collectFiles, parseAntdImports } from '../utils/scan.js';

export interface LintIssue {
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
function getDeprecatedProps(store: ReturnType<typeof loadMetadataForVersion>): Map<string, { prop: string; since: string; message: string }[]> {
  const result = new Map<string, { prop: string; since: string; message: string }[]>();
  for (const comp of store.components) {
    const deprecated = comp.props.filter((p) => p.deprecated);
    if (deprecated.length > 0) {
      result.set(comp.name, deprecated.map((p) => {
        const sinceStr = typeof p.deprecated === 'string' ? ` (since ${p.deprecated})` : '';
        // Use description directly as it contains replacement info like "use X instead"
        const desc = p.description ? `. ${p.description}` : '';
        return {
          prop: p.name,
          since: typeof p.deprecated === 'string' ? p.deprecated : 'unknown',
          message: `\`${p.name}\` is deprecated${sinceStr}${desc}`,
        };
      }));
    }
  }
  return result;
}

/** Check if a pattern exists within a window around index `i`. */
function hasNearbyMatch(lines: string[], i: number, lookahead: number, pattern: RegExp, lookbehind = 0): boolean {
  const start = Math.max(0, i - lookbehind);
  const end = Math.min(i + lookahead, lines.length);
  for (let j = start; j < end; j++) {
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
  const deprecatedChecks: { compName: string; dep: { prop: string; since: string; message: string }; regex: RegExp; compRegex: RegExp }[] = [];
  if (!only || only === 'deprecated') {
    for (const compName of importedComponents) {
      const deprecations = deprecatedMap.get(compName);
      if (!deprecations) continue;
      const compRegex = new RegExp(`<${escapeRegExp(compName)}[\\s/>]`);
      for (const dep of deprecations) {
        deprecatedChecks.push({
          compName,
          dep,
          regex: new RegExp(`\\b${escapeRegExp(dep.prop)}\\b\\s*[=({]`),
          compRegex,
        });
      }
    }
  }

  const hasImage = importedComponents.includes('Image');
  const hasSelect = importedComponents.includes('Select') || importedComponents.includes('TreeSelect');
  const hasButton = importedComponents.includes('Button');
  const hasCheckbox = importedComponents.includes('Checkbox');
  const hasDivider = importedComponents.includes('Divider');
  const hasMenu = importedComponents.includes('Menu');
  const hasQRCode = importedComponents.includes('QRCode');
  const hasRadio = importedComponents.includes('Radio');
  const hasTreeSelect = importedComponents.includes('TreeSelect');
  const hasTypography = importedComponents.includes('Typography');

  // Single pass over all lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Deprecated prop checks
    for (const { compName, dep, regex, compRegex } of deprecatedChecks) {
      if (regex.test(line) && hasNearbyMatch(lines, i, 3, compRegex, 10)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'deprecated',
          severity: 'warning',
          message: `${compName} ${dep.message}`,
        });
      }
    }

    // Deprecated component checks
    if (!only || only === 'deprecated') {
      if (/<BackTop\b/.test(line)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'deprecated',
          severity: 'warning',
          message: '`BackTop` is deprecated, use `FloatButton.BackTop` instead',
        });
      }

      if (hasButton && /<Button\.Group\b/.test(line)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'deprecated',
          severity: 'warning',
          message: '`Button.Group` is deprecated, use `Space.Compact` instead',
        });
      }

      if (/<Input\.Group\b/.test(line)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'deprecated',
          severity: 'warning',
          message: '`Input.Group` is deprecated, use `Space.Compact` instead',
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
    }

    // Usage checks (prop combination mistakes)
    if (!only || only === 'usage') {
      // Form.Item: shouldUpdate and dependencies should not be used together
      if (/Form\.Item\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 10, /shouldUpdate\s*[=]/) && hasNearbyMatch(lines, i, 10, /dependencies\s*[=]/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: '`shouldUpdate` and `dependencies` should not be used together on Form.Item',
          });
        }
      }

      // Button: ghost cannot be used with type="link" or type="text"
      if (hasButton && /<Button\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 5, /\bghost\b/) &&
            hasNearbyMatch(lines, i, 5, /type\s*=\s*['"{](?:link|text)['"}\s]/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'Button `ghost` prop cannot be used with `type="link"` or `type="text"`',
          });
        }
      }

      // Checkbox: value is not a valid prop, did you mean checked?
      if (hasCheckbox && /<Checkbox\b/.test(line) && !/Checkbox\.Group/.test(line)) {
        if (hasNearbyMatch(lines, i, 5, /\bvalue\s*=/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'Checkbox `value` is not a valid prop outside Checkbox.Group, did you mean `checked`?',
          });
        }
      }

      // Divider: children not working in vertical mode
      if (hasDivider && /<Divider\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 5, /type\s*=\s*['"{]vertical['"}]/) &&
            (!hasNearbyMatch(lines, i, 3, /\/>/) || hasNearbyMatch(lines, i, 5, /\bchildren\s*=/))) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'Divider `children` are not supported in `type="vertical"` mode',
          });
        }
      }

      // Select: maxCount only works with mode="multiple" or mode="tags"
      if (hasSelect && /<Select\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 10, /maxCount\s*=/) &&
            !hasNearbyMatch(lines, i, 10, /mode\s*=\s*['"{](?:multiple|tags)['"}]/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'Select `maxCount` only works with `mode="multiple"` or `mode="tags"`',
          });
        }
      }

      // Menu: inlineCollapsed should only be used when mode is inline
      if (hasMenu && /<Menu\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 10, /inlineCollapsed\s*=/) &&
            !hasNearbyMatch(lines, i, 10, /mode\s*=\s*['"{]inline['"}]/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'Menu `inlineCollapsed` should only be used with `mode="inline"`',
          });
        }
      }

      // QRCode: missing value prop
      if (hasQRCode && /<QRCode\b/.test(line) && !hasNearbyMatch(lines, i, 10, /\bvalue\s*=/)) {
        issues.push({
          file: filePath,
          line: i + 1,
          rule: 'usage',
          severity: 'warning',
          message: 'QRCode is missing required `value` prop',
        });
      }

      // Typography.Link: ellipsis only supports boolean
      if (hasTypography && /<Typography\.Link\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 5, /ellipsis\s*=\s*\{\{/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'Typography.Link `ellipsis` only supports boolean value, not object config',
          });
        }
      }

      // Typography.Text: ellipsis does not support expandable or rows
      if (hasTypography && /<Typography\.Text\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 10, /ellipsis\s*=\s*\{\{/) &&
            hasNearbyMatch(lines, i, 10, /\b(?:expandable|rows)\s*[=:]/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'Typography.Text `ellipsis` does not support `expandable` or `rows`',
          });
        }
      }

      // Radio: optionType is only supported on Radio.Group
      if (hasRadio && /<Radio\b/.test(line) && !/<Radio\.Group\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 5, /optionType\s*=/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: '`optionType` is only supported on Radio.Group, not Radio',
          });
        }
      }

      // TreeSelect: multiple={false} is ignored when treeCheckable is true
      if (hasTreeSelect && /<TreeSelect\b/.test(line)) {
        if (hasNearbyMatch(lines, i, 10, /multiple\s*=\s*\{?\s*false/) &&
            hasNearbyMatch(lines, i, 10, /treeCheckable\b/)) {
          issues.push({
            file: filePath,
            line: i + 1,
            rule: 'usage',
            severity: 'warning',
            message: 'TreeSelect `multiple={false}` is ignored when `treeCheckable` is true',
          });
        }
      }
    }

    // Performance checks
    if (!only || only === 'performance') {
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
    .option('--only <category>', 'Only check specific category (deprecated, a11y, usage, performance)')
    .action((target: string | undefined, cmdOpts: { only?: string }) => {
      const opts = program.opts<GlobalOptions>();
      const targetPath = target || '.';
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadataForVersion(versionInfo.version);
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
        usage: allIssues.filter((i) => i.rule === 'usage').length,
        performance: allIssues.filter((i) => i.rule === 'performance').length,
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

      console.log(`\nSummary: ${summary.deprecated} deprecated, ${summary.a11y} a11y, ${summary.usage} usage, ${summary.performance} performance`);
    });
}
