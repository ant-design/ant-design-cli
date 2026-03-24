# Bug Fixes Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs discovered while testing against ant-design-pro: escaped-pipe extraction error (root cause of 400+ malformed props across all data files), type-only import handling, sub-component false positives in `usage`, and missing replacement in lint deprecated messages.

**Architecture:** Three separate layers: (1) extraction script fix + data regeneration, (2) `usage` command improvements, (3) `lint` message improvement. Each is independent.

**Tech Stack:** TypeScript, Node 18, vitest, antd source at `/Users/afc163/Projects/ant-design` (required for data regeneration)

---

## Bugs

| # | File | Severity | Description |
|---|------|----------|-------------|
| A | `scripts/extractors/props.ts` | **Critical** | `parseTableRow` splits on `\|` (escaped pipes in markdown) → 400+ props have wrong `type`, `default`, `since` values across all data files |
| B | `src/utils/scan.ts` | **Medium** | `type`-only imports (`import { type X }`) should be excluded entirely, not included after stripping `type` keyword |
| C | `src/commands/usage.ts` | **Medium** | `SUB_COMPONENT_RE` counts method calls (`Form.useForm`, `Modal.confirm`, `App.useApp`) as sub-components; `Row`/`Col` wrongly appear as non-components |
| D | `src/commands/lint.ts` | **Minor** | Deprecated prop warning omits replacement hint when `deprecated === true` (boolean) |

---

## Chunk 1: Fix parseTableRow + Regenerate Data

### Task 1: Fix `parseTableRow` — handle `\|` escaped pipes

**Files:**
- Modify: `scripts/extractors/props.ts:7-13`

**Root cause:** The antd markdown docs use `\|` to put a literal pipe inside a table cell (so it renders as `type1 | type2` instead of starting a new column). The current `parseTableRow` splits on ALL `|` characters, including escaped ones. So `\`default\` \| \`primary\` \| \`danger\`` becomes three separate cells instead of one, shifting the entire row rightward. This means `type` gets only the first union option, `default` gets the second union option (wrong), and `since` gets the third union option (also wrong).

**Example from antd source:**
```markdown
| type | Syntactic sugar. Set button type | `primary` \| `dashed` \| `link` \| `text` \| `default` | `default` | |
```
Current output: `type.type = "`primary`"`, `type.default = "`dashed`"` (wrong!)
Correct output: `type.type = "`primary` | `dashed` | `link` | `text` | `default`"`, `type.default = "\`default\`"`

- [ ] **Step 1.1: Write failing test**

In `scripts/extractors/__tests__/props.test.ts` (create if not exists):
```typescript
import { describe, it, expect } from 'vitest';
// parseTableRow is not exported; test through parseTable via a helper
// Add a temporary export or test via extractProps with a temp markdown file

// For now, test the observable behavior: extract props from a mock markdown
// that uses \| in a type column

const MOCK_MD = `---
title: Test
---
## API

| Property | Description | Type | Default | Version |
| --- | --- | --- | --- | --- |
| color | Set color | \`default\` \\| \`primary\` \\| \`danger\` | \`default\` | 5.21.0 |
| disabled | Disabled | boolean | false |  |
`;
```

Add a `parseTableRow` export temporarily (or test through the full extraction path).

- [ ] **Step 1.2: Export `parseTableRow` for testing**

In `scripts/extractors/props.ts`, add `export` to `parseTableRow`:
```typescript
export function parseTableRow(row: string): string[] {
```

- [ ] **Step 1.3: Write the unit test**

Create `scripts/extractors/__tests__/props.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseTableRow } from '../props.js';

describe('parseTableRow', () => {
  it('handles normal rows', () => {
    const cells = parseTableRow('| foo | bar | baz |');
    expect(cells).toEqual(['foo', 'bar', 'baz']);
  });

  it('handles escaped pipes in type values', () => {
    const cells = parseTableRow(
      '| color | Set color | `default` \\| `primary` \\| `danger` | `default` | 5.21.0 |'
    );
    expect(cells).toEqual([
      'color',
      'Set color',
      '`default` | `primary` | `danger`',
      '`default`',
      '5.21.0',
    ]);
  });

  it('handles multiple escaped pipes', () => {
    const cells = parseTableRow('| type | desc | `a` \\| `b` \\| `c` | - |  |');
    expect(cells[2]).toBe('`a` | `b` | `c`');
    expect(cells[3]).toBe('-');
  });
});
```

- [ ] **Step 1.4: Run test — verify it fails**

```bash
cd /Users/afc163/Projects/ant-design-cli
npx vitest run scripts/extractors/__tests__/props.test.ts
```
Expected: FAIL — escaped pipe test gets `['color', 'Set color', '`default` \\']` instead

- [ ] **Step 1.5: Implement the fix**

In `scripts/extractors/props.ts`, change `parseTableRow`:
```typescript
export function parseTableRow(row: string): string[] {
  const PIPE = '\x00PIPE\x00';
  return row
    .replace(/\\\|/g, PIPE)    // protect escaped pipes first
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim().replace(new RegExp(PIPE, 'g'), '|'));
}
```

- [ ] **Step 1.6: Run test — verify it passes**

```bash
npx vitest run scripts/extractors/__tests__/props.test.ts
```
Expected: PASS (all 3 tests)

- [ ] **Step 1.7: Also remove the load-time `\` strip from `loader.ts`**

The previous round added defensive stripping of trailing ` \` in `src/data/loader.ts:normalizeStore`. Now that the extraction is fixed and data will be regenerated, the trailing `\` issue will no longer exist in newly generated files. However, keep the deduplication logic — only remove the `replace(/\s*\\$/, '')` calls:

In `src/data/loader.ts`, change `normalizeStore`:
```typescript
function normalizeStore(store: MetadataStore): MetadataStore {
  for (const comp of store.components) {
    const seen = new Set<string>();
    comp.props = comp.props.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }
  return store;
}
```
(Remove the prop field `.replace(/\s*\\$/, '')` lines — they are no longer needed after regeneration, and keeping them could accidentally corrupt legitimate data with trailing backslashes.)

- [ ] **Step 1.8: Run all tests — verify nothing broke**

```bash
npm run build && npm run test
```
Expected: 104+ tests pass

- [ ] **Step 1.9: Commit extraction fix**

```bash
git add scripts/extractors/props.ts scripts/extractors/__tests__/props.test.ts src/data/loader.ts
git commit -m "fix(extract): handle escaped pipes in markdown table cells"
```

---

### Task 2: Regenerate v6.json from current antd source

**Files:**
- Regenerate: `data/v6.json` (and optionally `data/v6.3.3.json`)

**Prerequisites:** antd source at `/Users/afc163/Projects/ant-design` — confirmed present.

- [ ] **Step 2.1: Run the extractor for v6**

```bash
node --experimental-vm-modules node_modules/.bin/tsx scripts/extract.ts \
  --antd-dir /Users/afc163/Projects/ant-design \
  --output data/v6.json
```

If the script requires a specific antd version tag, first check out the current state:
```bash
cd /Users/afc163/Projects/ant-design && git log --oneline -3
```

- [ ] **Step 2.2: Verify the fix — Button.color should now be correct**

```bash
node dist/index.js info Button --format json | python3 -c "
import json,sys; d=json.load(sys.stdin)
for p in d['props']:
    if p['name'] in ('color','type','variant'):
        print(p['name'], '->', p['type'], '| default:', p['default'])
"
```
Expected:
```
color -> `default` | `primary` | `danger` | ... | default: -
type  -> `primary` | `dashed` | `link` | `text` | `default` | default: `default`
```

- [ ] **Step 2.3: Check malformed props count dropped to zero in v6.json**

```bash
python3 -c "
import json
d = json.load(open('data/v6.json'))
bad = sum(1 for c in d['components'] for p in c['props']
          if p.get('type','').endswith('\\\\') or p.get('default','').endswith('\\\\'))
print(f'Malformed props: {bad}')  # should be 0
"
```

- [ ] **Step 2.4: Run tests**

```bash
npm run test
```

- [ ] **Step 2.5: Commit regenerated data**

```bash
git add data/v6.json
git commit -m "data: regenerate v6.json with fixed pipe handling in type fields"
```

---

## Chunk 2: Fix `scan.ts` type-only imports + `usage.ts` improvements

### Task 3: Exclude type-only imports from `parseAntdImports`

**Files:**
- Modify: `src/utils/scan.ts:46`
- Modify: `src/utils/__tests__/scan.test.ts`

**Current behavior:** `import { type InputRef, Button }` → strips `type` → produces `['InputRef', 'Button']`. `InputRef` then shows in nonComponents output.

**Desired behavior:** `import { type InputRef, Button }` → `['Button']` only. Type-only imports are not runtime values and have no component usage to track.

- [ ] **Step 3.1: Update test in `src/utils/__tests__/scan.test.ts`**

Find the existing test for type keyword handling and change its expectation:
```typescript
it('excludes type-only imports', () => {
  const result = parseAntdImports("import { type InputRef, Button } from 'antd'");
  expect(result).toEqual(['Button']);         // InputRef excluded, not included
  expect(result).not.toContain('InputRef');
  expect(result).not.toContain('type InputRef');
});
```

- [ ] **Step 3.2: Run test — verify it fails (shows ['InputRef', 'Button'])**

```bash
npx vitest run src/utils/__tests__/scan.test.ts
```

- [ ] **Step 3.3: Fix `parseAntdImports`**

In `src/utils/scan.ts:46`, change:
```typescript
// Before:
const parsed = match[1].split(',').map((n) => n.trim().replace(/^type\s+/, '')).filter(Boolean);

// After:
const parsed = match[1].split(',')
  .map((n) => n.trim())
  .filter((n) => Boolean(n) && !/^type\s/.test(n));
```

- [ ] **Step 3.4: Run tests — verify pass**

```bash
npm run test
```

- [ ] **Step 3.5: Commit**

```bash
git add src/utils/scan.ts src/utils/__tests__/scan.test.ts
git commit -m "fix(scan): exclude type-only imports instead of stripping type keyword"
```

---

### Task 4: Fix `usage.ts` sub-component false positives + Row/Col classification

**Files:**
- Modify: `src/commands/usage.ts`

**Two separate issues:**

**Issue C1 (sub-component method calls):** `SUB_COMPONENT_RE` (`\b(\w+)\.(\w+)\b`) matches `Form.useForm`, `Modal.confirm`, `App.useApp`. These are method/hook calls, not JSX sub-component usages. Fix: only count matches where the child token starts with an uppercase letter (React component naming convention).

**Issue C2 (Row/Col):** `Row` and `Col` are top-level antd exports, but they're documented as sub-components of `Grid` in the metadata (`Grid.Row`, `Grid.Col`). Fix: expand `knownComponents` to also include sub-component leaf names from `subComponentProps`.

- [ ] **Step 4.1: Fix sub-component uppercase filter**

In `src/commands/usage.ts`, find the sub-component loop and add the filter:
```typescript
while ((match = SUB_COMPONENT_RE.exec(content)) !== null) {
  const [, parent, child] = match;
  // Only count sub-components that follow React capitalized naming (e.g. Form.Item, not Form.useForm)
  if (importedNames.includes(parent) && /^[A-Z]/.test(child)) {
    const entry = result.get(parent)!;
    const subKey = `${parent}.${child}`;
    entry.subComponents.set(subKey, (entry.subComponents.get(subKey) || 0) + 1);
  }
}
```

- [ ] **Step 4.2: Expand `knownComponents` to include sub-component leaf names**

In `src/commands/usage.ts`, after building `knownComponents`:
```typescript
const knownComponents = new Set(store.components.map((c) => c.name));
// Include directly-importable sub-components (e.g. Row, Col from Grid.Row, Grid.Col)
for (const comp of store.components) {
  for (const subKey of Object.keys((comp as any).subComponentProps ?? {})) {
    const leaf = subKey.split('.').pop();
    if (leaf) knownComponents.add(leaf);
  }
}
```

> Note: `subComponentProps` is not in `ComponentData` types — use `(comp as any)` or add it to the type.

- [ ] **Step 4.3: Check `ComponentData` type definition**

In `src/types.ts`, verify that `subComponentProps` is part of `ComponentData`:
```typescript
export interface ComponentData {
  // ...
  subComponentProps?: Record<string, PropData[]>;
  // ...
}
```
If present, remove the `as any` cast.

- [ ] **Step 4.4: Build and verify manually**

```bash
npm run build
node dist/index.js usage /Users/afc163/Projects/ant-design-pro/src 2>&1 | grep -E "Row|Col|Form\.use|App\.use|Modal\.confirm"
```
Expected:
- `Row` and `Col` appear in the **components** section
- `Form.useForm`, `App.useApp`, `Modal.confirm` do NOT appear in sub-components

Also verify nonComponents no longer shows `Row`/`Col`:
```bash
node dist/index.js usage /Users/afc163/Projects/ant-design-pro/src 2>&1 | grep -A10 "Non-component"
```
Expected: `Row` and `Col` absent from non-components list.

- [ ] **Step 4.5: Run tests**

```bash
npm run test
```

- [ ] **Step 4.6: Commit**

```bash
git add src/commands/usage.ts src/types.ts
git commit -m "fix(usage): exclude method calls from sub-components, classify Row/Col as components"
```

---

## Chunk 3: Fix lint deprecated message + update spec.md

### Task 5: Improve lint deprecated message to include replacement

**Files:**
- Modify: `src/commands/lint.ts:28-31`

**Current behavior:** When `p.deprecated === true` (boolean), message = `` `bordered` prop is deprecated ``. No replacement hint.

**Data source:** The `description` field on deprecated props often contains the replacement. For Card `bordered`: `"Toggles rendering of the border around the card, please use \`variant\` instead"`.

**Desired behavior:** Extract the replacement from description and append it to the lint message.

- [ ] **Step 5.1: Inspect the pattern**

```bash
node dist/index.js info Card --format json | python3 -c "
import json,sys; d=json.load(sys.stdin)
for p in d['props']:
    if p.get('deprecated') == True:
        print(p['name'], '->', p.get('description',''))
"
```
Expected output shows `bordered -> Toggles rendering of the border around the card, please use \`variant\` instead`.

- [ ] **Step 5.2: Write failing test**

In `src/__tests__/cli.test.ts`, add a test for the lint deprecated message format:
```typescript
it('includes replacement hint in deprecated prop warning', async () => {
  // Run lint on a fixture file that uses Card bordered prop
  // The message should include the replacement hint
  const fixture = path.join(tmpDir, 'card-test.tsx');
  fs.writeFileSync(fixture, `
    import { Card } from 'antd';
    const App = () => <Card bordered={false}>Content</Card>;
  `);
  const result = await run(['lint', fixture]);
  expect(result.stdout).toMatch(/bordered.*deprecated/i);
  expect(result.stdout).toMatch(/variant/i);  // replacement hint
});
```

- [ ] **Step 5.3: Implement the fix**

In `src/commands/lint.ts`, update `getDeprecatedProps`:
```typescript
function getDeprecatedProps(store: ReturnType<typeof loadMetadataForVersion>): Map<string, { prop: string; since: string; message: string }[]> {
  const result = new Map<string, { prop: string; since: string; message: string }[]>();
  for (const comp of store.components) {
    const deprecated = comp.props.filter((p) => p.deprecated);
    if (deprecated.length > 0) {
      result.set(comp.name, deprecated.map((p) => {
        // Extract "use X instead" hint from description if deprecated is boolean
        let hint = '';
        if (p.deprecated === true && p.description) {
          const useMatch = p.description.match(/(?:use|replaced? by|see)\s+(`[^`]+`|\w+)/i);
          if (useMatch) hint = `, use ${useMatch[1]} instead`;
        }
        const sinceStr = typeof p.deprecated === 'string' ? ` since ${p.deprecated}` : '';
        return {
          prop: p.name,
          since: typeof p.deprecated === 'string' ? p.deprecated : 'unknown',
          message: `\`${p.name}\` prop is deprecated${sinceStr}${hint}`,
        };
      }));
    }
  }
  return result;
}
```

- [ ] **Step 5.4: Run tests**

```bash
npm run test
```

- [ ] **Step 5.5: Verify manually against ant-design-pro**

```bash
node dist/index.js lint /Users/afc163/Projects/ant-design-pro/src --only deprecated
```
Expected: `Card \`bordered\` prop is deprecated, use \`variant\` instead`

- [ ] **Step 5.6: Commit**

```bash
git add src/commands/lint.ts
git commit -m "fix(lint): include replacement hint in deprecated prop warning"
```

---

### Task 6: Update spec.md

**Files:**
- Modify: `spec.md`

- [ ] **Step 6.1: Update scan behavior section**

In the `usage` command section, update the import parsing description:
```markdown
TypeScript `import { type X }` syntax is handled — type-only imports are excluded entirely (they are not runtime values and have no component usage to track).
```

- [ ] **Step 6.2: Update lint section**

In the `lint` command section, document the improved deprecated message format:
```markdown
When a deprecated prop has a replacement hint in its description (e.g. "please use \`variant\` instead"),
the lint warning includes the replacement: `` `bordered` prop is deprecated, use `variant` instead ``
```

- [ ] **Step 6.3: Commit**

```bash
git add spec.md
git commit -m "docs: update spec for type import exclusion and deprecated message improvements"
```

---

## Verification Checklist

After all tasks complete:

```bash
# 1. Full test suite
npm run test
# Expected: 104+ tests pass

# 2. Button.color type should be full union
node dist/index.js info Button --format json | python3 -c "
import json,sys; d=json.load(sys.stdin)
color = next(p for p in d['props'] if p['name']=='color')
print('type:', color['type'])
print('default:', color['default'])
"
# Expected: type contains multiple options joined with |

# 3. No type-only imports in usage
node dist/index.js usage /Users/afc163/Projects/ant-design-pro/src --format json | python3 -c "
import json,sys; d=json.load(sys.stdin)
all_names = [c['name'] for c in d['components']] + [c['name'] for c in d.get('nonComponents',[])]
print('InputRef in output:', 'InputRef' in all_names)
print('FormInstance in output:', 'FormInstance' in all_names)
"
# Expected: both False

# 4. Row/Col now in components, not non-components
node dist/index.js usage /Users/afc163/Projects/ant-design-pro/src --format json | python3 -c "
import json,sys; d=json.load(sys.stdin)
comp_names = [c['name'] for c in d['components']]
non_names = [c['name'] for c in d.get('nonComponents',[])]
print('Row in components:', 'Row' in comp_names)
print('Col in components:', 'Col' in comp_names)
print('Row in nonComponents:', 'Row' in non_names)
"
# Expected: Row/Col in components, not in nonComponents

# 5. No method call sub-components
node dist/index.js usage /Users/afc163/Projects/ant-design-pro/src --format json | python3 -c "
import json,sys; d=json.load(sys.stdin)
for c in d['components']:
    for sub in (c.get('subComponents') or {}).keys():
        parent, child = sub.split('.')
        if child[0].islower():
            print('FALSE POSITIVE:', sub)
"
# Expected: no output

# 6. Deprecated message includes replacement
node dist/index.js lint /Users/afc163/Projects/ant-design-pro/src --only deprecated
# Expected: "Card `bordered` prop is deprecated, use `variant` instead"
```
