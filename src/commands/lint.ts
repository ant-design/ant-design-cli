import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { readFileSync } from 'node:fs';
import { parseSync, Visitor } from 'oxc-parser';
import { loadMetadataForVersion } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { output } from '../output/formatter.js';
import { collectFiles, getJSXElementName } from '../utils/scan.js';

export interface LintIssue {
  file: string;
  line: number;
  rule: string;
  severity: 'warning' | 'error';
  message: string;
}

type DeprecatedInfo = { prop: string; since: string; message: string };

function getDeprecatedProps(store: ReturnType<typeof loadMetadataForVersion>): Map<string, DeprecatedInfo[]> {
  const result = new Map<string, DeprecatedInfo[]>();
  for (const comp of store.components) {
    const deprecated = comp.props.filter((p) => p.deprecated);
    if (deprecated.length > 0) {
      result.set(comp.name, deprecated.map((p) => {
        const sinceStr = typeof p.deprecated === 'string' ? ` (since ${p.deprecated})` : '';
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

// --- AST helpers ---

function findAttr(attrs: any[], name: string): any | null {
  return attrs.find((a: any) => a.type === 'JSXAttribute' && a.name?.name === name) ?? null;
}

function hasAttr(attrs: any[], name: string): boolean {
  return findAttr(attrs, name) !== null;
}

function getStringAttrValue(attrs: any[], name: string): string | null {
  const a = findAttr(attrs, name);
  if (!a) return null;
  if (a.value?.type === 'Literal' && typeof a.value.value === 'string') {
    return a.value.value;
  }
  if (a.value?.type === 'JSXExpressionContainer' &&
      a.value.expression?.type === 'Literal' &&
      typeof a.value.expression.value === 'string') {
    return a.value.expression.value;
  }
  return null;
}

function isBooleanFalse(attrs: any[], name: string): boolean {
  const a = findAttr(attrs, name);
  if (!a) return false;
  return a.value?.type === 'JSXExpressionContainer' &&
    a.value.expression?.type === 'Literal' &&
    a.value.expression.value === false;
}

function isObjectExpression(attrs: any[], name: string): boolean {
  const a = findAttr(attrs, name);
  if (!a) return false;
  return a.value?.type === 'JSXExpressionContainer' &&
    a.value.expression?.type === 'ObjectExpression';
}

function getObjectExpressionKeys(attrs: any[], name: string): string[] {
  const a = findAttr(attrs, name);
  if (!a) return [];
  if (a.value?.type === 'JSXExpressionContainer' &&
      a.value.expression?.type === 'ObjectExpression') {
    return a.value.expression.properties
      .filter((p: any) => p.type === 'Property' && p.key)
      .map((p: any) => p.key.name || p.key.value)
      .filter(Boolean);
  }
  /* v8 ignore start -- unreachable: all ObjectExpression cases handled above */
  return [];
}
/* v8 ignore stop */

/** Create a stateful offset-to-line converter that exploits monotonically increasing offsets. */
function createLineMapper(source: string): (offset: number) => number {
  let lastOffset = 0;
  let lastLine = 1;
  return (offset: number) => {
    /* v8 ignore next 4 -- defensive: AST visitor offsets are monotonically increasing */
    if (offset < lastOffset) {
      lastOffset = 0;
      lastLine = 1;
    }
    for (let i = lastOffset; i < offset && i < source.length; i++) {
      if (source[i] === '\n') lastLine++;
    }
    lastOffset = offset;
    return lastLine;
  };
}

function normalizeAntdAliases(antdAliases?: string[]): string[] {
  const normalized = (antdAliases ?? [])
    .flatMap((source) => source.split(','))
    .map((source) => source.trim())
    .filter(Boolean);

  return Array.from(new Set(['antd', ...normalized]));
}

function matchesAntdAlias(source: string, antdAliases: string[]): boolean {
  return antdAliases.some((antdAlias) => source === antdAlias || source.startsWith(`${antdAlias}/`));
}

function mayContainAntdAlias(content: string, antdAliases: string[]): boolean {
  return antdAliases.some((antdAlias) => content.includes(antdAlias));
}

function collectAntdAlias(source: string, previous: string[]): string[] {
  return [...previous, source];
}

function lintFile(
  filePath: string,
  deprecatedMap: Map<string, DeprecatedInfo[]>,
  antdAliases: string[],
  only?: string,
): LintIssue[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
    /* v8 ignore start -- fs read error */
  } catch {
    return [];
  }
  /* v8 ignore stop */

  // Fast pre-check: skip files that don't reference configured antd aliases
  if (!mayContainAntdAlias(content, antdAliases)) return [];

  const result = parseSync(filePath, content);
  if (result.errors.length > 0) return [];

  const issues: LintIssue[] = [];
  const importedComponents = new Set<string>();
  const offsetToLine = createLineMapper(content);

  const lineOf = (node: any): number => {
    if (typeof node.start === 'number') return offsetToLine(node.start);
    return node.loc?.start?.line ?? 0;
  };

  const report = (rule: string, severity: LintIssue['severity'], line: number, message: string) => {
    issues.push({ file: filePath, line, rule, severity, message });
  };

  // Single pass: collect imports and check all rules
  const visitor = new Visitor({
    ImportDeclaration(node: any) {
      const source = node.source.value;
      if (!matchesAntdAlias(source, antdAliases)) return;

      if (node.importKind === 'type') return;

      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          if (spec.importKind === 'type') continue;
          const name = spec.imported?.name || spec.local?.name;
          if (name) importedComponents.add(name);
        }

        if ((!only || only === 'performance') &&
            (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportNamespaceSpecifier')) {
          report('performance', 'error', lineOf(node),
            `Avoid wildcard import from ${source}. Use named imports: \`import { Button } from '${source}'\``);
        }
      }
    },

    JSXOpeningElement(node: any) {
      const compName = getJSXElementName(node.name);
      if (!compName) return;
      const attrs = node.attributes || [];
      const line = lineOf(node);

      // --- Deprecated checks ---
      if (!only || only === 'deprecated') {
        if (compName === 'BackTop' && importedComponents.has('BackTop')) {
          report('deprecated', 'warning', line, '`BackTop` is deprecated, use `FloatButton.BackTop` instead');
        }
        if (compName === 'Button.Group' && importedComponents.has('Button')) {
          report('deprecated', 'warning', line, '`Button.Group` is deprecated, use `Space.Compact` instead');
        }
        if (compName === 'Input.Group' && importedComponents.has('Input')) {
          report('deprecated', 'warning', line, '`Input.Group` is deprecated, use `Space.Compact` instead');
        }

        const baseName = compName.includes('.') ? compName.split('.')[0] : compName;
        if (importedComponents.has(baseName) || importedComponents.has(compName)) {
          const deprecations = deprecatedMap.get(compName);
          if (deprecations) {
            for (const attr of attrs) {
              if (attr.type !== 'JSXAttribute') continue;
              const propName = attr.name?.name;
              const dep = deprecations.find((d) => d.prop === propName);
              if (dep) {
                report('deprecated', 'warning', lineOf(attr) || line, `${compName} ${dep.message}`);
              }
            }
          }
        }
      }

      // --- Accessibility checks ---
      if (!only || only === 'a11y') {
        if (compName === 'Image' && importedComponents.has('Image')) {
          if (!hasAttr(attrs, 'alt')) {
            report('a11y', 'warning', line, 'Image component is missing `alt` prop for accessibility');
          }
        }

        if (compName.endsWith('Icon') && hasAttr(attrs, 'onClick') && !hasAttr(attrs, 'aria-label')) {
          report('a11y', 'warning', line, 'Clickable icon should have `aria-label` for screen readers');
        }
      }

      // --- Usage checks ---
      if (!only || only === 'usage') {
        if (compName === 'Form.Item' && importedComponents.has('Form')) {
          if (hasAttr(attrs, 'shouldUpdate') && hasAttr(attrs, 'dependencies')) {
            report('usage', 'warning', line, '`shouldUpdate` and `dependencies` should not be used together on Form.Item');
          }
        }

        if (compName === 'Button' && importedComponents.has('Button')) {
          if (hasAttr(attrs, 'ghost')) {
            const typeVal = getStringAttrValue(attrs, 'type');
            if (typeVal === 'link' || typeVal === 'text') {
              report('usage', 'warning', line, 'Button `ghost` prop cannot be used with `type="link"` or `type="text"`');
            }
          }
        }

        if (compName === 'Checkbox' && importedComponents.has('Checkbox')) {
          if (hasAttr(attrs, 'value')) {
            report('usage', 'warning', line, 'Checkbox `value` is not a valid prop outside Checkbox.Group, did you mean `checked`?');
          }
        }

        if (compName === 'Divider' && importedComponents.has('Divider')) {
          const typeVal = getStringAttrValue(attrs, 'type');
          if (typeVal === 'vertical' && (!node.selfClosing || hasAttr(attrs, 'children'))) {
            report('usage', 'warning', line, 'Divider `children` are not supported in `type="vertical"` mode');
          }
        }

        if (compName === 'Select' && importedComponents.has('Select')) {
          if (hasAttr(attrs, 'maxCount')) {
            const modeVal = getStringAttrValue(attrs, 'mode');
            if (modeVal !== 'multiple' && modeVal !== 'tags') {
              report('usage', 'warning', line, 'Select `maxCount` only works with `mode="multiple"` or `mode="tags"`');
            }
          }
        }

        if (compName === 'Menu' && importedComponents.has('Menu')) {
          if (hasAttr(attrs, 'inlineCollapsed')) {
            const modeVal = getStringAttrValue(attrs, 'mode');
            if (modeVal !== 'inline') {
              report('usage', 'warning', line, 'Menu `inlineCollapsed` should only be used with `mode="inline"`');
            }
          }
        }

        if (compName === 'QRCode' && importedComponents.has('QRCode')) {
          if (!hasAttr(attrs, 'value')) {
            report('usage', 'warning', line, 'QRCode is missing required `value` prop');
          }
        }

        if (compName === 'Typography.Link' && importedComponents.has('Typography')) {
          if (isObjectExpression(attrs, 'ellipsis')) {
            report('usage', 'warning', line, 'Typography.Link `ellipsis` only supports boolean value, not object config');
          }
        }

        if (compName === 'Typography.Text' && importedComponents.has('Typography')) {
          if (isObjectExpression(attrs, 'ellipsis')) {
            const keys = getObjectExpressionKeys(attrs, 'ellipsis');
            if (keys.includes('expandable') || keys.includes('rows')) {
              report('usage', 'warning', line, 'Typography.Text `ellipsis` does not support `expandable` or `rows`');
            }
          }
        }

        if (compName === 'Radio' && importedComponents.has('Radio')) {
          if (hasAttr(attrs, 'optionType')) {
            report('usage', 'warning', line, '`optionType` is only supported on Radio.Group, not Radio');
          }
        }

        if (compName === 'TreeSelect' && importedComponents.has('TreeSelect')) {
          if (isBooleanFalse(attrs, 'multiple') && hasAttr(attrs, 'treeCheckable')) {
            report('usage', 'warning', line, 'TreeSelect `multiple={false}` is ignored when `treeCheckable` is true');
          }
        }
      }

      // --- Performance checks ---
      if (!only || only === 'performance') {
        if ((compName === 'Select' && importedComponents.has('Select')) ||
            (compName === 'TreeSelect' && importedComponents.has('TreeSelect'))) {
          if (isBooleanFalse(attrs, 'virtual')) {
            report('performance', 'warning', line, 'Disabling `virtual` scroll on Select may cause performance issues with large datasets');
          }
        }
      }
    },
  });
  visitor.visit(result.program);

  return issues;
}

export function registerLintCommand(program: Command): void {
  program
    .command('lint [target]')
    .description('Check antd usage against best practices')
    .option('--only <category>', 'Only check specific category (deprecated, a11y, usage, performance)')
    .option('--antd-alias <source>', 'Treat additional package names as aliases of antd imports', collectAntdAlias, [])
    .action((target: string | undefined, cmdOpts: { only?: string; antdAlias?: string[] }) => {
      const opts = program.opts<GlobalOptions>();
      const targetPath = target || '.';
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadataForVersion(versionInfo.version);
      const deprecatedMap = getDeprecatedProps(store);
      const antdAliases = normalizeAntdAliases(cmdOpts.antdAlias);

      const files = collectFiles(targetPath);
      const allIssues: LintIssue[] = [];

      for (const file of files) {
        allIssues.push(...lintFile(file, deprecatedMap, antdAliases, cmdOpts.only));
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
