import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { localize } from '../types.js';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';
import { loadMetadataForVersion } from '../data/loader.js';
import { detectVersion } from '../data/version.js';
import { formatTable, output } from '../output/formatter.js';
import {
  collectFiles,
  getJSXElementName,
  normalizeComponentKey,
  SCAN_EXTENSIONS,
  SKIP_DIRS,
} from '../utils/scan.js';

export interface LintIssue {
  file: string;
  line: number;
  rule: string;
  severity: 'warning' | 'error';
  message: string;
}

interface SkippedFile {
  file: string;
  reason: 'read-error' | 'parse-error';
  message: string;
}

type DeprecatedInfo = { prop: string; since: string; message: string };
type LintCommandOptions = { only?: string; antdAlias?: string[]; diff?: boolean | string; staged?: boolean };

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

function extractDeprecatedNotice(source: string | undefined): string | undefined {
  const notice = source?.match(
    /:::warning\{\s*title\s*=\s*["']?(?:Deprecated Notice|废弃提示)["']?\s*\}\s*([\s\S]*?)\s*:::/,
  );
  return notice?.[1]?.replace(/\s+/g, ' ').trim();
}

export function getDeprecatedComponents(
  store: ReturnType<typeof loadMetadataForVersion>,
  lang: string,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const comp of store.components) {
    const englishDetail = extractDeprecatedNotice(comp.whenToUse);
    const chineseDetail = extractDeprecatedNotice(comp.whenToUseZh);
    const englishMessage = englishDetail && `\`${comp.name}\` is deprecated. ${englishDetail}`;
    const chineseMessage = chineseDetail && `\`${comp.name}\` 已废弃。${chineseDetail}`;
    const fallbackMessage = englishMessage ?? chineseMessage;
    if (!fallbackMessage) continue;
    result.set(
      comp.name,
      localize(englishMessage ?? fallbackMessage, chineseMessage ?? fallbackMessage, lang),
    );
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
  /* v8 ignore next -- guarded by isObjectExpression() check at every call site */
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

function getMemberPath(node: any): string[] {
  if (!node) return [];
  if (node.type === 'Identifier') return [node.name];
  if (node.type === 'ChainExpression') return getMemberPath(node.expression);
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const objectPath = getMemberPath(node.object);
    if (objectPath.length === 0) return [];
    let propertyName: string | undefined;
    if (node.property?.type === 'Identifier' && !node.computed) {
      propertyName = node.property.name;
    } else if (node.property?.type === 'Literal' && typeof node.property.value === 'string') {
      propertyName = node.property.value;
    }
    return propertyName ? [...objectPath, propertyName] : [];
  }
  return [];
}

function collectPatternNames(pattern: any, names: string[] = []): string[] {
  if (!pattern) return names;
  if (pattern.type === 'Identifier') {
    names.push(pattern.name);
  /* v8 ignore start -- defensive support for uncommon binding patterns */
  } else if (pattern.type === 'AssignmentPattern') {
    collectPatternNames(pattern.left, names);
  } else if (pattern.type === 'RestElement') {
    collectPatternNames(pattern.argument, names);
  } else if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements ?? []) collectPatternNames(element, names);
  } else if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties ?? []) {
      if (property.type === 'Property') {
        collectPatternNames(property.value, names);
      } else if (property.type === 'RestElement') {
        collectPatternNames(property.argument, names);
      }
    }
  } else if (pattern.pattern) {
    collectPatternNames(pattern.pattern, names);
  }
  /* v8 ignore stop */
  return names;
}

type BindingScopeKind = 'program' | 'function' | 'block' | 'catch' | 'class' | 'loop' | 'switch' | 'static';

function collectScopeBindings(program: any): Map<any, Set<string>> {
  const bindings = new Map<any, Set<string>>();
  const scopeStack: { node: any; kind: BindingScopeKind }[] = [];

  const pushScope = (node: any, kind: BindingScopeKind) => {
    bindings.set(node, new Set());
    scopeStack.push({ node, kind });
  };
  const declareIn = (scope: { node: any }, pattern: any) => {
    const names = bindings.get(scope.node)!;
    for (const name of collectPatternNames(pattern)) names.add(name);
  };
  const currentScope = () => scopeStack[scopeStack.length - 1];
  const nearestFunctionScope = () => [...scopeStack].reverse().find(
    ({ kind }) => kind === 'function' || kind === 'program' || kind === 'static',
  )!;
  const pushFunctionScope = (node: any) => {
    pushScope(node, 'function');
    if (node.type === 'FunctionExpression' && node.id) declareIn(currentScope(), node.id);
    for (const param of node.params ?? []) declareIn(currentScope(), param);
  };

  pushScope(program, 'program');
  const visitor = new Visitor({
    BlockStatement(node: any) {
      pushScope(node, 'block');
    },
    'BlockStatement:exit'() {
      scopeStack.pop();
    },
    FunctionDeclaration(node: any) {
      declareIn(currentScope(), node.id);
      pushFunctionScope(node);
    },
    'FunctionDeclaration:exit'() {
      scopeStack.pop();
    },
    FunctionExpression: pushFunctionScope,
    'FunctionExpression:exit'() {
      scopeStack.pop();
    },
    ArrowFunctionExpression: pushFunctionScope,
    'ArrowFunctionExpression:exit'() {
      scopeStack.pop();
    },
    ClassDeclaration(node: any) {
      declareIn(currentScope(), node.id);
      pushScope(node, 'class');
      declareIn(currentScope(), node.id);
    },
    'ClassDeclaration:exit'() {
      scopeStack.pop();
    },
    ClassExpression(node: any) {
      pushScope(node, 'class');
      if (node.id) declareIn(currentScope(), node.id);
    },
    'ClassExpression:exit'() {
      scopeStack.pop();
    },
    ForStatement(node: any) {
      pushScope(node, 'loop');
    },
    'ForStatement:exit'() {
      scopeStack.pop();
    },
    ForInStatement(node: any) {
      pushScope(node, 'loop');
    },
    'ForInStatement:exit'() {
      scopeStack.pop();
    },
    ForOfStatement(node: any) {
      pushScope(node, 'loop');
    },
    'ForOfStatement:exit'() {
      scopeStack.pop();
    },
    SwitchStatement(node: any) {
      pushScope(node, 'switch');
    },
    'SwitchStatement:exit'() {
      scopeStack.pop();
    },
    StaticBlock(node: any) {
      pushScope(node, 'static');
    },
    'StaticBlock:exit'() {
      scopeStack.pop();
    },
    CatchClause(node: any) {
      pushScope(node, 'catch');
      if (node.param) declareIn(currentScope(), node.param);
    },
    'CatchClause:exit'() {
      scopeStack.pop();
    },
    VariableDeclaration(node: any) {
      const target = node.kind === 'var' ? nearestFunctionScope() : currentScope();
      for (const declaration of node.declarations ?? []) declareIn(target, declaration.id);
    },
  });
  visitor.visit(program);
  scopeStack.pop();
  return bindings;
}

const STATIC_FEEDBACK_METHODS: Record<string, string[]> = {
  message: ['open', 'success', 'error', 'info', 'warning', 'warn', 'loading'],
  notification: ['open', 'success', 'error', 'info', 'warning', 'warn'],
  Modal: ['confirm', 'info', 'success', 'error', 'warning', 'warn'],
};

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

function getComponentFromSubpath(
  source: string,
  antdAliases: string[],
  componentBySubpath: Map<string, string>,
): string | undefined {
  const matchedAlias = [...antdAliases]
    .sort((a, b) => b.length - a.length)
    .find((antdAlias) => source.startsWith(`${antdAlias}/`))!;

  const parts = source.slice(matchedAlias.length + 1).split('/');
  const componentParts = parts[0] === 'es' || parts[0] === 'lib' ? parts.slice(1) : parts;
  if (componentParts.includes('style') || componentParts.includes('locale')) return undefined;

  for (let i = componentParts.length - 1; i >= 0; i--) {
    const componentName = componentBySubpath.get(normalizeComponentKey(componentParts[i]));
    if (componentName) return componentName;
  }
  return undefined;
}

function isLocalePath(source: string, antdAliases: string[]): boolean {
  return antdAliases.some(
    (alias) =>
      source.startsWith(`${alias}/locale/`) ||
      source.startsWith(`${alias}/es/locale/`) ||
      source.startsWith(`${alias}/lib/locale/`),
  );
}

const MODULE_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts']);

// A source like `antd/dist/reset.css` resolves to a bundler asset with only a
// default export, so the default/namespace-import performance rule can't apply.
// Bare specifiers and extensionless subpaths (`antd`, `antd/es/button`) have no
// extension and are treated as modules.
function isNonModuleSource(source: string): boolean {
  const match = /\.([^./]+)$/.exec(source);
  if (!match) return false;
  return !MODULE_EXTENSIONS.has(match[1].toLowerCase());
}

interface CollectedAntdImports {
  importedComponents: Set<string>;
  antdImportLocals: Map<string, string>;
  antdRootImportLocals: Set<string>;
  performanceImports: {
    node: any;
    source: string;
    localName: string;
    kind: 'namespace' | 'default';
  }[];
}

function collectAntdImports(
  program: any,
  antdAliases: string[],
  componentBySubpath: Map<string, string>,
): CollectedAntdImports {
  const importedComponents = new Set<string>();
  const antdImportLocals = new Map<string, string>();
  const antdRootImportLocals = new Set<string>();
  const performanceImports: CollectedAntdImports['performanceImports'] = [];

  const visitor = new Visitor({
    ImportDeclaration(node: any) {
      const source = node.source.value;
      if (!matchesAntdAlias(source, antdAliases) || node.importKind === 'type') return;

      const isRootImport = antdAliases.includes(source);
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier' && spec.importKind !== 'type') {
          const name = spec.imported?.name || spec.local?.name;
          const localName = spec.local?.name || name;
          if (name) importedComponents.add(name);
          if (name && localName) antdImportLocals.set(localName, name);
        }

        if (spec.type === 'ImportNamespaceSpecifier' && isRootImport) {
          antdRootImportLocals.add(spec.local?.name ?? '');
        }

        if (spec.type === 'ImportDefaultSpecifier') {
          const localName = spec.local?.name;
          if (localName && isRootImport) {
            antdRootImportLocals.add(localName);
          } else if (localName) {
            const componentName = getComponentFromSubpath(source, antdAliases, componentBySubpath);
            if (componentName) {
              importedComponents.add(componentName);
              antdImportLocals.set(localName, componentName);
            }
          }
        }

        const isNamespace = spec.type === 'ImportNamespaceSpecifier';
        const isDefault = spec.type === 'ImportDefaultSpecifier';
        if ((isNamespace || isDefault) && !isLocalePath(source, antdAliases) && !isNonModuleSource(source)) {
          performanceImports.push({
            node,
            source,
            localName: spec.local?.name ?? '',
            kind: isNamespace ? 'namespace' : 'default',
          });
        }
      }
    },
  });
  visitor.visit(program);

  return { importedComponents, antdImportLocals, antdRootImportLocals, performanceImports };
}

function mayContainAntdAlias(content: string, antdAliases: string[]): boolean {
  return antdAliases.some((antdAlias) => content.includes(antdAlias));
}

function collectAntdAlias(source: string, previous: string[]): string[] {
  return [...previous, source];
}

function execGit(cwd: string, args: string[]): string {
  const options: ExecFileSyncOptionsWithStringEncoding = { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    return execFileSync('git', args, options);
  } catch (error) {
    const stderr = typeof (error as { stderr?: unknown }).stderr === 'string'
      ? (error as { stderr: string }).stderr.trim()
      : '';
    throw new Error(stderr || (error instanceof Error ? error.message : 'git command failed'));
  }
}

function getGitRoot(targetPath: string): string {
  const absoluteTarget = resolve(targetPath);
  if (!existsSync(absoluteTarget)) {
    throw new Error(`Lint target not found: ${targetPath}`);
  }
  let gitCwd = absoluteTarget;
  try {
    if (statSync(absoluteTarget).isFile()) {
      gitCwd = dirname(absoluteTarget);
    }
  /* v8 ignore start -- defensive: the path may change between existsSync and statSync */
  } catch {
    gitCwd = absoluteTarget;
  }
  /* v8 ignore stop */
  return execGit(gitCwd, ['rev-parse', '--show-toplevel']).trim();
}

function getPathspec(repoRoot: string, targetPath: string): string {
  const rel = relative(repoRoot, resolve(targetPath));
  return rel === '' ? '.' : rel.replace(/\\/g, '/');
}

function isLintableSource(filePath: string, gitPath = filePath): boolean {
  if (!existsSync(filePath)) return false;
  try {
    if (!statSync(filePath).isFile()) return false;
  /* v8 ignore start -- defensive: the file may change between existsSync and statSync */
  } catch {
    return false;
  }
  /* v8 ignore stop */
  if (!SCAN_EXTENSIONS.has(extname(filePath))) return false;
  return !gitPath.split(/[\\/]/).some((segment) => SKIP_DIRS.has(segment) || segment.startsWith('.umi'));
}

function resolveDiffBase(repoRoot: string, diff: boolean | string | undefined): string {
  if (typeof diff === 'string' && diff.trim()) {
    const requested = diff.trim();
    try {
      return execGit(repoRoot, ['merge-base', requested, 'HEAD']).trim() || requested;
    } catch {
      return requested;
    }
  }

  try {
    return execGit(repoRoot, ['merge-base', 'origin/main', 'HEAD']).trim();
  } catch {
    return 'HEAD';
  }
}

function collectGitFiles(targetPath: string, mode: 'diff' | 'staged', diff?: boolean | string): string[] {
  const repoRoot = getGitRoot(targetPath);
  const pathspec = getPathspec(repoRoot, targetPath);
  const args = mode === 'staged'
    ? ['diff', '--name-only', '--cached', '--diff-filter=ACMR', '--', pathspec]
    : ['diff', '--name-only', '--diff-filter=ACMR', resolveDiffBase(repoRoot, diff), '--', pathspec];

  return execGit(repoRoot, args)
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => isLintableSource(join(repoRoot, file), file))
    .map((file) => join(repoRoot, file));
}

function lintFile(
  filePath: string,
  deprecatedMap: Map<string, DeprecatedInfo[]>,
  deprecatedComponents: Map<string, string>,
  componentBySubpath: Map<string, string>,
  antdAliases: string[],
  antdMajor: number,
  only?: string,
): { issues: LintIssue[]; skipped?: SkippedFile } {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
    /* v8 ignore start -- fs read error */
  } catch (error) {
    return {
      issues: [],
      skipped: {
        file: filePath,
        reason: 'read-error',
        message: error instanceof Error ? error.message : 'Failed to read file',
      },
    };
  }
  /* v8 ignore stop */

  // Fast pre-check: skip files that don't reference configured antd aliases
  if (!mayContainAntdAlias(content, antdAliases)) return { issues: [] };

  const result = parseSync(filePath, content);
  if (result.errors.length > 0) {
    return {
      issues: [],
      skipped: {
        file: filePath,
        reason: 'parse-error',
        message: result.errors[0]?.message ?? 'Failed to parse file',
      },
    };
  }

  const issues: LintIssue[] = [];
  const {
    importedComponents,
    antdImportLocals,
    antdRootImportLocals,
    performanceImports,
  } = collectAntdImports(result.program, antdAliases, componentBySubpath);
  const offsetToLine = createLineMapper(content);
  const enableV5UsageRules = antdMajor >= 5;

  const lineOf = (node: any): number => {
    if (typeof node.start === 'number') return offsetToLine(node.start);
    /* v8 ignore next -- oxc-parser always emits numeric start offsets; loc fallback is defensive */
    return node.loc?.start?.line ?? 0;
  };

  const report = (rule: string, severity: LintIssue['severity'], line: number, message: string) => {
    issues.push({ file: filePath, line, rule, severity, message });
  };

  // Track JSX ancestor stack for context-aware rules (e.g. Checkbox inside Checkbox.Group)
  const jsxAncestorStack: string[] = [];
  const isInsideComponent = (name: string): boolean => jsxAncestorStack.includes(name);

  // Track namespace/default import usage for performance rule suggestions
  const pendingPerformanceIssues = (!only || only === 'performance')
    ? performanceImports.map(({ node, ...item }) => ({ line: lineOf(node), ...item }))
    : [];
  const namespaceMemberUsage = new Map(
    pendingPerformanceIssues.map((item) => [item.localName, new Set<string>()]),
  );
  const scopeBindings = collectScopeBindings(result.program);
  const scopeStack: Set<string>[] = [scopeBindings.get(result.program) ?? new Set()];
  const pushScope = (node: any) => scopeStack.push(scopeBindings.get(node) ?? new Set());

  const isShadowed = (name: string): boolean => scopeStack.some((scope) => scope.has(name));

  const resolveCanonicalComponent = (
    compName: string,
  ): { root: string; full: string } | null => {
    const [localRoot, ...members] = compName.split('.');
    if (!localRoot || isShadowed(localRoot)) return null;

    const importedRoot = antdImportLocals.get(localRoot);
    if (importedRoot) {
      return { root: importedRoot, full: [importedRoot, ...members].join('.') };
    }
    if (antdRootImportLocals.has(localRoot) && members.length > 0) {
      return { root: members[0], full: members.join('.') };
    }
    return null;
  };

  // Single pass: collect imports and check all rules
  const visitor = new Visitor({
    BlockStatement: pushScope,
    'BlockStatement:exit'() {
      scopeStack.pop();
    },
    FunctionDeclaration: pushScope,
    'FunctionDeclaration:exit'() {
      scopeStack.pop();
    },
    FunctionExpression: pushScope,
    'FunctionExpression:exit'() {
      scopeStack.pop();
    },
    ArrowFunctionExpression: pushScope,
    'ArrowFunctionExpression:exit'() {
      scopeStack.pop();
    },
    ClassDeclaration: pushScope,
    'ClassDeclaration:exit'() {
      scopeStack.pop();
    },
    ClassExpression: pushScope,
    'ClassExpression:exit'() {
      scopeStack.pop();
    },
    ForStatement: pushScope,
    'ForStatement:exit'() {
      scopeStack.pop();
    },
    ForInStatement: pushScope,
    'ForInStatement:exit'() {
      scopeStack.pop();
    },
    ForOfStatement: pushScope,
    'ForOfStatement:exit'() {
      scopeStack.pop();
    },
    SwitchStatement: pushScope,
    'SwitchStatement:exit'() {
      scopeStack.pop();
    },
    StaticBlock: pushScope,
    'StaticBlock:exit'() {
      scopeStack.pop();
    },
    CatchClause: pushScope,
    'CatchClause:exit'() {
      scopeStack.pop();
    },
    JSXElement(node: any) {
      const elName = getJSXElementName(node.openingElement?.name);
      jsxAncestorStack.push(elName);
    },
    'JSXElement:exit'() {
      jsxAncestorStack.pop();
    },

    CallExpression(node: any) {
      if (only && only !== 'usage') return;
      if (!enableV5UsageRules) return;

      const path = getMemberPath(node.callee);
      if (path.length < 2) return;
      const importedName = antdImportLocals.get(path[0]);
      const method = path[1];
      const callName = path.join('.');
      const line = lineOf(node);

      if (importedName && !isShadowed(path[0]) && STATIC_FEEDBACK_METHODS[importedName]?.includes(method)) {
        report('usage', 'warning', line, `Static antd feedback API \`${callName}\` cannot consume ConfigProvider context. Use App.useApp() instead.`);
      }
    },

    JSXOpeningElement(node: any) {
      const compName = getJSXElementName(node.name);
      if (!compName) return;
      const attrs = node.attributes || [];
      const line = lineOf(node);

      // Collect member usage from namespace/default imports (e.g. <Antd.Button />)
      if (compName.includes('.')) {
        const [obj, prop] = compName.split('.');
        if (obj && prop) {
          const members = namespaceMemberUsage.get(obj);
          if (members) members.add(prop);
        }
      }

      // --- Deprecated checks ---
      if (!only || only === 'deprecated') {
        const canonicalComponent = resolveCanonicalComponent(compName);
        if (canonicalComponent?.full === 'BackTop') {
          report('deprecated', 'warning', line, '`BackTop` is deprecated, use `FloatButton.BackTop` instead');
        }
        if (canonicalComponent?.full === 'Button.Group') {
          report('deprecated', 'warning', line, '`Button.Group` is deprecated, use `Space.Compact` instead');
        }
        if (canonicalComponent?.full === 'Input.Group') {
          report('deprecated', 'warning', line, '`Input.Group` is deprecated, use `Space.Compact` instead');
        }

        if (canonicalComponent) {
          const componentNotice = deprecatedComponents.get(canonicalComponent.root);
          if (componentNotice) {
            report('deprecated', 'warning', line, componentNotice);
          }
          const deprecations = deprecatedMap.get(canonicalComponent.full);
          if (deprecations) {
            for (const attr of attrs) {
              if (attr.type !== 'JSXAttribute') continue;
              const propName = attr.name?.name;
              const dep = deprecations.find((d) => d.prop === propName);
              if (dep) {
                report('deprecated', 'warning', lineOf(attr) || line, `${canonicalComponent.full} ${dep.message}`);
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
          if (hasAttr(attrs, 'value') && !isInsideComponent('Checkbox.Group')) {
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
          if (hasAttr(attrs, 'optionType') && !isInsideComponent('Radio.Group')) {
            report('usage', 'warning', line, '`optionType` is only supported on Radio.Group, not Radio');
          }
        }

        if (compName === 'TreeSelect' && importedComponents.has('TreeSelect')) {
          if (isBooleanFalse(attrs, 'multiple') && hasAttr(attrs, 'treeCheckable')) {
            report('usage', 'warning', line, 'TreeSelect `multiple={false}` is ignored when `treeCheckable` is true');
          }
        }

        if (enableV5UsageRules && (compName === 'Upload' || compName === 'Upload.Dragger') && importedComponents.has('Upload')) {
          if (hasAttr(attrs, 'fileList') && hasAttr(attrs, 'defaultFileList')) {
            report('usage', 'warning', line, 'Upload should not use both controlled `fileList` and uncontrolled `defaultFileList`');
          } else if (hasAttr(attrs, 'fileList') && !hasAttr(attrs, 'onChange')) {
            report('usage', 'warning', line, 'Upload with controlled `fileList` should provide `onChange`');
          }
        }

        if (enableV5UsageRules && importedComponents.has('Select')) {
          if (compName === 'Select.Option') {
            report('usage', 'warning', line, 'Select.Option children are not recommended in antd v5+. Use the `options` prop instead.');
          }
          if (compName === 'Select.OptGroup') {
            report('usage', 'warning', line, 'Select.OptGroup children are not recommended in antd v5+. Use grouped `options` instead.');
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

  // Process deferred performance issues with actual member usage
  for (const pending of pendingPerformanceIssues) {
    const usedMembers = namespaceMemberUsage.get(pending.localName);
    const memberList = usedMembers?.size ? [...usedMembers].join(', ') : '';
    const importKind = pending.kind === 'namespace' ? 'wildcard' : 'default';
    const suggestion = memberList
      ? `Use named imports: \`import { ${memberList} } from '${pending.source}'\``
      : 'Use named imports instead';
    report('performance', 'error', pending.line, `Avoid ${importKind} import from ${pending.source}. ${suggestion}`);
  }

  return { issues };
}

function printSkippedFiles(skippedFiles: SkippedFile[]): void {
  for (const skipped of skippedFiles) {
    console.log(`  - ${skipped.file} [${skipped.reason}] ${skipped.message}`);
  }
}

export function registerLintCommand(program: Command): void {
  program
    .command('lint [target]')
    .description('Check antd usage against best practices')
    .option('--only <category>', 'Only check specific category (deprecated, a11y, usage, performance)')
    .option('--antd-alias <source>', 'Treat additional package names as aliases of antd imports', collectAntdAlias, [])
    .option('--diff [base]', 'Only lint files changed from a git diff base (default: origin/main, fallback: HEAD)')
    .option('--staged', 'Only lint staged git files')
    .action((target: string | undefined, cmdOpts: LintCommandOptions) => {
      const opts = program.opts<GlobalOptions>();
      const targetPath = target || '.';
      if (cmdOpts.diff && cmdOpts.staged) {
        program.error('--diff and --staged cannot be used together');
      }
      const versionInfo = detectVersion(opts.version);
      const store = loadMetadataForVersion(versionInfo.version);
      const deprecatedMap = getDeprecatedProps(store);
      const deprecatedComponents = getDeprecatedComponents(store, opts.lang);
      const componentBySubpath = new Map(
        store.components.map((component) => [normalizeComponentKey(component.name), component.name]),
      );
      const antdAliases = normalizeAntdAliases(cmdOpts.antdAlias);

      let files: string[];
      try {
        files = cmdOpts.staged
          ? collectGitFiles(targetPath, 'staged')
          : cmdOpts.diff
            ? collectGitFiles(targetPath, 'diff', cmdOpts.diff)
            : collectFiles(targetPath);
      } catch (error) {
        program.error(error instanceof Error ? error.message : String(error));
      }
      const allIssues: LintIssue[] = [];
      const skippedFiles: SkippedFile[] = [];

      for (const file of files) {
        const result = lintFile(file, deprecatedMap, deprecatedComponents, componentBySubpath, antdAliases, parseInt(versionInfo.majorVersion.slice(1), 10), cmdOpts.only);
        allIssues.push(...result.issues);
        if (result.skipped) skippedFiles.push(result.skipped);
      }

      const summary = {
        total: allIssues.length,
        deprecated: allIssues.filter((i) => i.rule === 'deprecated').length,
        a11y: allIssues.filter((i) => i.rule === 'a11y').length,
        usage: allIssues.filter((i) => i.rule === 'usage').length,
        performance: allIssues.filter((i) => i.rule === 'performance').length,
        skipped: skippedFiles.length,
      };

      if (opts.format === 'json') {
        output({ issues: allIssues, skippedFiles, partial: skippedFiles.length > 0, summary }, 'json');
        return;
      }

      const summaryParts = [
        localize(`${summary.deprecated} deprecated`, `${summary.deprecated} 已废弃`, opts.lang),
        localize(`${summary.a11y} a11y`, `${summary.a11y} 无障碍`, opts.lang),
        localize(`${summary.usage} usage`, `${summary.usage} 用法`, opts.lang),
        localize(`${summary.performance} performance`, `${summary.performance} 性能`, opts.lang),
        localize(`${summary.skipped} skipped`, `${summary.skipped} 已跳过`, opts.lang),
      ].join(', ');

      if (opts.format === 'markdown' && (allIssues.length > 0 || skippedFiles.length > 0)) {
        console.log(`## ${localize('Lint Results', 'Lint 结果', opts.lang)}`);
        console.log('');
        console.log(localize(
          `Scanned ${files.length} files. Found ${allIssues.length} issues.`,
          `扫描了 ${files.length} 个文件，发现 ${allIssues.length} 个问题。`,
          opts.lang,
        ));
        console.log('');
        if (allIssues.length > 0) {
          const headers = [
            localize('Rule', '规则', opts.lang),
            localize('Severity', '级别', opts.lang),
            localize('Message', '信息', opts.lang),
            localize('File', '文件', opts.lang),
          ];
          const rows = allIssues.map((i) => [i.rule, i.severity, i.message, `${i.file}:${i.line}`]);
          console.log(formatTable(headers, rows, 'markdown'));
        }
        if (skippedFiles.length > 0) {
          console.log('');
          console.log(`### ${localize('Skipped Files', '跳过文件', opts.lang)}`);
          console.log('');
          console.log(formatTable(
            [
              localize('Reason', '原因', opts.lang),
              localize('Message', '信息', opts.lang),
              localize('File', '文件', opts.lang),
            ],
            skippedFiles.map((file) => [file.reason, file.message, file.file]),
            'markdown',
          ));
        }
        console.log('');
        console.log(`**${localize('Summary:', '摘要：', opts.lang)}** ${summaryParts}`);
        return;
      }

      if (allIssues.length === 0) {
        console.log(localize(
          `Scanned ${files.length} files. No issues found.`,
          `扫描了 ${files.length} 个文件，未发现问题。`,
          opts.lang,
        ));
        if (skippedFiles.length > 0) {
          console.log(localize(
            `Skipped ${skippedFiles.length} file${skippedFiles.length > 1 ? 's' : ''}:`,
            `跳过 ${skippedFiles.length} 个文件：`,
            opts.lang,
          ));
          printSkippedFiles(skippedFiles);
        }
        return;
      }

      console.log(localize(
        `Scanned ${files.length} files. Found ${allIssues.length} issues:`,
        `扫描了 ${files.length} 个文件，发现 ${allIssues.length} 个问题：`,
        opts.lang,
      ) + '\n');

      for (const issue of allIssues) {
        const icon = issue.severity === 'error' ? '✗' : '⚠';
        console.log(`  ${icon} ${issue.file}:${issue.line} [${issue.rule}]`);
        console.log(`    ${issue.message}`);
      }

      if (skippedFiles.length > 0) {
        console.log(`\n${localize('Skipped files:', '跳过文件：', opts.lang)}`);
        printSkippedFiles(skippedFiles);
      }

      console.log(`\n${localize('Summary:', '摘要：', opts.lang)} ${summaryParts}`);
    });
}
