# Bug Report Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `antd bug` and `antd bug-cli` commands that auto-collect environment info, preview issue content, and optionally submit to GitHub via `gh` CLI.

**Architecture:** Two new commands in `src/commands/bug.ts`, shared issue-building utilities in `src/utils/issue.ts`. Preview mode (default) outputs assembled issue content; `--submit` mode calls `gh issue create`. Follows existing command patterns (read global opts, format output, print errors to stderr).

**Tech Stack:** TypeScript, commander, Node.js child_process (for `gh` CLI), vitest for tests.

**Spec:** `docs/superpowers/specs/2026-03-23-bug-report-commands-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/issue.ts` | Create | Environment collection, issue body building, URL encoding, `gh` submit |
| `src/commands/bug.ts` | Create | Register `bug` and `bug-cli` commands, wire params to utils |
| `src/output/error.ts` | Modify | Add 2 new error codes (`GH_NOT_FOUND`, `GH_SUBMIT_FAILED`) |
| `src/index.ts` | Modify | Import and register the two new commands |
| `src/__tests__/bug.test.ts` | Create | Unit tests for `src/utils/issue.ts` |
| `src/__tests__/cli.test.ts` | Modify | E2E tests for `antd bug` and `antd bug-cli` |
| `skills/antd/SKILL.md` | Modify | Add scenario 8 (reporting issues) and allowed-tools |
| `spec.md` | Modify | Update command count from 12→14, add bug/bug-cli sections |

---

### Task 1: Add error codes

**Files:**
- Modify: `src/output/error.ts:1-11`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/bug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ErrorCodes } from '../output/error.js';

describe('bug command error codes', () => {
  it('should have GH_NOT_FOUND error code', () => {
    expect(ErrorCodes.GH_NOT_FOUND).toBe('GH_NOT_FOUND');
  });

  it('should have GH_SUBMIT_FAILED error code', () => {
    expect(ErrorCodes.GH_SUBMIT_FAILED).toBe('GH_SUBMIT_FAILED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: FAIL — `GH_NOT_FOUND` does not exist on `ErrorCodes`

- [ ] **Step 3: Add error codes to error.ts**

In `src/output/error.ts`, add to the `ErrorCodes` object:

```typescript
export const ErrorCodes = {
  COMPONENT_NOT_FOUND: 'COMPONENT_NOT_FOUND',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  NO_PROJECT_DETECTED: 'NO_PROJECT_DETECTED',
  METADATA_FETCH_FAILED: 'METADATA_FETCH_FAILED',
  UNSUPPORTED_VERSION_FEATURE: 'UNSUPPORTED_VERSION_FEATURE',
  DEMO_NOT_FOUND: 'DEMO_NOT_FOUND',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  GH_NOT_FOUND: 'GH_NOT_FOUND',
  GH_SUBMIT_FAILED: 'GH_SUBMIT_FAILED',
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/output/error.ts src/__tests__/bug.test.ts
git commit -m "feat(bug): add error codes for bug report commands"
```

---

### Task 2: Create `src/utils/issue.ts` — environment collection

**Files:**
- Create: `src/utils/issue.ts`
- Modify: `src/__tests__/bug.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/bug.test.ts`:

```typescript
import { collectAntdEnv, collectCliEnv } from '../utils/issue.js';
import { join } from 'node:path';

describe('collectAntdEnv', () => {
  it('should return unknown when node_modules does not exist', () => {
    const env = collectAntdEnv('/tmp/nonexistent-dir-xyz');
    expect(env.antd).toBe('unknown');
    expect(env.react).toBe('unknown');
    expect(env.system).toBeTruthy();
  });

  it('should accept a version override', () => {
    const env = collectAntdEnv('/tmp/nonexistent-dir-xyz', '5.20.0');
    expect(env.antd).toBe('5.20.0');
  });
});

describe('collectCliEnv', () => {
  it('should return CLI version and Node version', () => {
    const env = collectCliEnv();
    expect(env.cli).toBeTruthy();
    expect(env.node).toBe(process.version);
    expect(env.system).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: FAIL — cannot import from `../utils/issue.js`

- [ ] **Step 3: Implement environment collection**

Create `src/utils/issue.ts`:

```typescript
import { platform, release } from 'node:os';
import { readJson } from './scan.js';
import { join } from 'node:path';

declare const __CLI_VERSION__: string;

export interface AntdEnv {
  antd: string;
  react: string;
  system: string;
  browser: string;
}

export interface CliEnv {
  cli: string;
  node: string;
  system: string;
}

function getSystem(): string {
  return `${platform()} ${release()}`;
}

export function collectAntdEnv(cwd: string, versionOverride?: string): AntdEnv {
  const antdPkg = readJson(join(cwd, 'node_modules', 'antd', 'package.json'));
  const reactPkg = readJson(join(cwd, 'node_modules', 'react', 'package.json'));

  return {
    antd: versionOverride || antdPkg?.version || 'unknown',
    react: reactPkg?.version || 'unknown',
    system: getSystem(),
    browser: '-',
  };
}

export function collectCliEnv(): CliEnv {
  let cliVersion: string;
  try {
    cliVersion = __CLI_VERSION__;
  } catch {
    cliVersion = 'unknown';
  }
  return {
    cli: cliVersion,
    node: process.version,
    system: getSystem(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/issue.ts src/__tests__/bug.test.ts
git commit -m "feat(bug): add environment collection utilities"
```

---

### Task 3: Create `src/utils/issue.ts` — body builders and URL encoding

**Files:**
- Modify: `src/utils/issue.ts`
- Modify: `src/__tests__/bug.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/bug.test.ts`:

```typescript
import { buildAntdIssueBody, buildCliIssueBody, buildIssueUrl } from '../utils/issue.js';

describe('buildAntdIssueBody', () => {
  it('should produce antd-issue-helper format', () => {
    const body = buildAntdIssueBody({
      reproduction: 'https://codesandbox.io/s/test',
      steps: '1. Click button',
      expected: 'Works',
      actual: 'Crashes',
      env: { antd: '5.29.3', react: '18.3.1', system: 'darwin 24.0', browser: '-' },
    });
    expect(body).toContain('<!-- generated by @ant-design/cli. DO NOT REMOVE -->');
    expect(body).toContain('### Reproduction link');
    expect(body).toContain('https://codesandbox.io/s/test');
    expect(body).toContain('| antd | 5.29.3 |');
    expect(body).toContain('| React | 18.3.1 |');
  });

  it('should use placeholder for empty fields', () => {
    const body = buildAntdIssueBody({
      env: { antd: '5.29.3', react: '18.3.1', system: 'darwin 24.0', browser: '-' },
    });
    expect(body).toContain('_No response_');
  });
});

describe('buildCliIssueBody', () => {
  it('should produce CLI issue format', () => {
    const body = buildCliIssueBody({
      description: 'Info crashes',
      steps: '1. Run antd info',
      expected: 'Shows props',
      actual: 'Crashes',
      env: { cli: '6.3.3', node: 'v20.11.0', system: 'darwin 24.0' },
    });
    expect(body).toContain('### Description');
    expect(body).toContain('Info crashes');
    expect(body).toContain('| @ant-design/cli | 6.3.3 |');
  });
});

describe('buildIssueUrl', () => {
  it('should produce a valid GitHub new issue URL', () => {
    const url = buildIssueUrl('ant-design/ant-design', 'Test title', 'Test body');
    expect(url).toMatch(/^https:\/\/github\.com\/ant-design\/ant-design\/issues\/new\?/);
    expect(url).toContain('title=Test+title');
  });

  it('should truncate body when URL exceeds 8000 chars', () => {
    const longBody = 'x'.repeat(10000);
    const url = buildIssueUrl('ant-design/ant-design', 'Title', longBody);
    expect(url.length).toBeLessThanOrEqual(8000);
    expect(url).toContain('Content+truncated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement body builders and URL encoding**

Add to `src/utils/issue.ts`:

```typescript
const PLACEHOLDER = '_No response_';
const MAX_URL_LENGTH = 8000;

export interface AntdIssueFields {
  reproduction?: string;
  steps?: string;
  expected?: string;
  actual?: string;
  extra?: string;
  env: AntdEnv;
}

export interface CliIssueFields {
  description?: string;
  steps?: string;
  expected?: string;
  actual?: string;
  extra?: string;
  env: CliEnv;
}

export function buildAntdIssueBody(fields: AntdIssueFields): string {
  const reproduction = fields.reproduction || PLACEHOLDER;
  const steps = fields.steps || PLACEHOLDER;
  const expected = fields.expected || PLACEHOLDER;
  const actual = fields.actual || PLACEHOLDER;
  const extra = fields.extra || '';

  let body = `<!-- generated by @ant-design/cli. DO NOT REMOVE -->

### Reproduction link

[${reproduction}](${reproduction})

### Steps to reproduce

${steps}

### What is expected?

${expected}

### What is actually happening?

${actual}

| Environment | Info |
| --- | --- |
| antd | ${fields.env.antd} |
| React | ${fields.env.react} |
| System | ${fields.env.system} |
| Browser | ${fields.env.browser} |`;

  if (extra) {
    body += `\n\n---\n${extra}`;
  }

  return body;
}

export function buildCliIssueBody(fields: CliIssueFields): string {
  const description = fields.description || PLACEHOLDER;
  const steps = fields.steps || PLACEHOLDER;
  const expected = fields.expected || PLACEHOLDER;
  const actual = fields.actual || PLACEHOLDER;
  const extra = fields.extra || '';

  let body = `### Description

${description}

### Steps to Reproduce

${steps}

### Expected Behavior

${expected}

### Actual Behavior

${actual}

### Environment

| Info | Value |
|------|-------|
| @ant-design/cli | ${fields.env.cli} |
| Node | ${fields.env.node} |
| System | ${fields.env.system} |`;

  if (extra) {
    body += `\n\n---\n${extra}`;
  }

  return body;
}

export function buildIssueUrl(repo: string, title: string, body: string): string {
  const baseUrl = `https://github.com/${repo}/issues/new`;
  const params = new URLSearchParams({ title, body });
  let url = `${baseUrl}?${params.toString()}`;

  if (url.length > MAX_URL_LENGTH) {
    const truncationNote = '\n\n(Content truncated. Please add remaining details after opening.)';
    // Binary search for max body length that fits
    let lo = 0;
    let hi = body.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const truncated = body.slice(0, mid) + truncationNote;
      const testParams = new URLSearchParams({ title, body: truncated });
      const testUrl = `${baseUrl}?${testParams.toString()}`;
      if (testUrl.length <= MAX_URL_LENGTH) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const truncatedBody = body.slice(0, lo) + truncationNote;
    const finalParams = new URLSearchParams({ title, body: truncatedBody });
    url = `${baseUrl}?${finalParams.toString()}`;
  }

  return url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/issue.ts src/__tests__/bug.test.ts
git commit -m "feat(bug): add issue body builders and URL encoding"
```

---

### Task 4: Create `src/utils/issue.ts` — `gh` submit function

**Files:**
- Modify: `src/utils/issue.ts`
- Modify: `src/__tests__/bug.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/bug.test.ts`:

```typescript
import { checkGhAvailable } from '../utils/issue.js';

describe('checkGhAvailable', () => {
  it('should return a boolean', () => {
    const result = checkGhAvailable();
    expect(typeof result).toBe('boolean');
  });
});
```

Note: We cannot easily test `submitViaGh` in unit tests (it calls `gh issue create` for real). It will be covered by manual/e2e testing. We test `checkGhAvailable` as the testable piece.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: FAIL — `checkGhAvailable` not exported

- [ ] **Step 3: Implement gh CLI helpers**

Add to `src/utils/issue.ts`:

```typescript
import { execFileSync } from 'node:child_process';

export function checkGhAvailable(): boolean {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export interface SubmitResult {
  issueNumber: number;
  url: string;
}

export function submitViaGh(repo: string, title: string, body: string): SubmitResult {
  const result = execFileSync('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body', body], {
    encoding: 'utf-8',
    timeout: 30000,
  }).trim();

  // gh issue create outputs the issue URL, e.g. https://github.com/org/repo/issues/123
  const match = result.match(/\/issues\/(\d+)/);
  const issueNumber = match ? parseInt(match[1], 10) : 0;

  return {
    issueNumber,
    url: result,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/issue.ts src/__tests__/bug.test.ts
git commit -m "feat(bug): add gh CLI availability check and submit function"
```

---

### Task 5: Create `src/commands/bug.ts` — `antd bug` command

**Files:**
- Create: `src/commands/bug.ts`

- [ ] **Step 1: Write the failing e2e test**

Append to `src/__tests__/bug.test.ts`:

```typescript
// These tests require `npm run build` first — they are marked as e2e
// But we can test the registration by importing directly
import { registerBugCommand } from '../commands/bug.js';
import { Command } from 'commander';

describe('registerBugCommand', () => {
  it('should register the bug command', () => {
    const program = new Command();
    registerBugCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'bug');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('antd');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: FAIL — cannot import `../commands/bug.js`

- [ ] **Step 3: Implement `registerBugCommand`**

Create `src/commands/bug.ts`:

```typescript
import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { createError, ErrorCodes, printError } from '../output/error.js';
import { output } from '../output/formatter.js';
import {
  collectAntdEnv,
  collectCliEnv,
  buildAntdIssueBody,
  buildCliIssueBody,
  buildIssueUrl,
  checkGhAvailable,
  submitViaGh,
} from '../utils/issue.js';

const ANTD_REPO = 'ant-design/ant-design';
const CLI_REPO = 'ant-design/ant-design-cli';

export function registerBugCommand(program: Command): void {
  program
    .command('bug')
    .description('Report a bug to the antd repository')
    .requiredOption('--title <title>', 'Issue title')
    .option('--reproduction <url>', 'Reproduction link')
    .option('--steps <text>', 'Steps to reproduce')
    .option('--expected <text>', 'Expected behavior')
    .option('--actual <text>', 'Actual behavior')
    .option('--extra <text>', 'Additional comments')
    .option('--submit', 'Submit via gh CLI instead of previewing', false)
    .action((cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const env = collectAntdEnv(process.cwd(), opts.version);
      const body = buildAntdIssueBody({
        reproduction: cmdOpts.reproduction,
        steps: cmdOpts.steps,
        expected: cmdOpts.expected,
        actual: cmdOpts.actual,
        extra: cmdOpts.extra,
        env,
      });
      const title = cmdOpts.title;

      if (cmdOpts.submit) {
        if (!checkGhAvailable()) {
          printError(
            createError(ErrorCodes.GH_NOT_FOUND, 'gh CLI is not installed or not in PATH', 'Install GitHub CLI: https://cli.github.com/ — or remove --submit to get a pre-filled URL instead'),
            opts.format,
          );
          process.exit(1);
        }
        try {
          const result = submitViaGh(ANTD_REPO, title, body);
          if (opts.format === 'json') {
            output({ repo: ANTD_REPO, title, issueNumber: result.issueNumber, url: result.url }, 'json');
          } else {
            console.log(`Issue created: ${result.url}`);
          }
        } catch (err: any) {
          printError(
            createError(ErrorCodes.GH_SUBMIT_FAILED, `Failed to create issue: ${err.message}`, 'Check your gh authentication with `gh auth status`'),
            opts.format,
          );
          process.exit(2);
        }
        return;
      }

      // Preview mode
      const url = buildIssueUrl(ANTD_REPO, title, body);

      if (opts.format === 'json') {
        output({ repo: ANTD_REPO, title, body, url }, 'json');
      } else if (opts.format === 'markdown') {
        console.log(body);
      } else {
        console.log(`Repository: ${ANTD_REPO}`);
        console.log(`Title: ${title}`);
        console.log('');
        console.log('--- Issue Body ---');
        console.log(body);
        console.log('--- End ---');
        console.log('');
        console.log('To submit, re-run with --submit flag.');
      }
    });
}

export function registerBugCliCommand(program: Command): void {
  program
    .command('bug-cli')
    .description('Report a bug to the ant-design-cli repository')
    .requiredOption('--title <title>', 'Issue title')
    .option('--description <desc>', 'Problem description')
    .option('--steps <text>', 'Steps to reproduce')
    .option('--expected <text>', 'Expected behavior')
    .option('--actual <text>', 'Actual behavior')
    .option('--extra <text>', 'Additional comments')
    .option('--submit', 'Submit via gh CLI instead of previewing', false)
    .action((cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const env = collectCliEnv();
      const body = buildCliIssueBody({
        description: cmdOpts.description,
        steps: cmdOpts.steps,
        expected: cmdOpts.expected,
        actual: cmdOpts.actual,
        extra: cmdOpts.extra,
        env,
      });
      const title = cmdOpts.title;

      if (cmdOpts.submit) {
        if (!checkGhAvailable()) {
          printError(
            createError(ErrorCodes.GH_NOT_FOUND, 'gh CLI is not installed or not in PATH', 'Install GitHub CLI: https://cli.github.com/ — or remove --submit to get a pre-filled URL instead'),
            opts.format,
          );
          process.exit(1);
        }
        try {
          const result = submitViaGh(CLI_REPO, title, body);
          if (opts.format === 'json') {
            output({ repo: CLI_REPO, title, issueNumber: result.issueNumber, url: result.url }, 'json');
          } else {
            console.log(`Issue created: ${result.url}`);
          }
        } catch (err: any) {
          printError(
            createError(ErrorCodes.GH_SUBMIT_FAILED, `Failed to create issue: ${err.message}`, 'Check your gh authentication with `gh auth status`'),
            opts.format,
          );
          process.exit(2);
        }
        return;
      }

      // Preview mode
      const url = buildIssueUrl(CLI_REPO, title, body);

      if (opts.format === 'json') {
        output({ repo: CLI_REPO, title, body, url }, 'json');
      } else if (opts.format === 'markdown') {
        console.log(body);
      } else {
        console.log(`Repository: ${CLI_REPO}`);
        console.log(`Title: ${title}`);
        console.log('');
        console.log('--- Issue Body ---');
        console.log(body);
        console.log('--- End ---');
        console.log('');
        console.log('To submit, re-run with --submit flag.');
      }
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/bug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/bug.ts src/__tests__/bug.test.ts
git commit -m "feat(bug): implement antd bug and bug-cli commands"
```

---

### Task 6: Register commands in `src/index.ts`

**Files:**
- Modify: `src/index.ts:1-2` (imports) and `src/index.ts:44` (registration)

- [ ] **Step 1: Add import**

Add to the imports section of `src/index.ts`:

```typescript
import { registerBugCommand, registerBugCliCommand } from './commands/bug.js';
```

- [ ] **Step 2: Register commands**

After the "Project Analysis commands" block (~line 44), add:

```typescript
// Issue Reporting commands
registerBugCommand(program);
registerBugCliCommand(program);
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Smoke test**

Run: `node dist/index.js bug --title "Test issue" --format json`
Expected: JSON output with `repo`, `title`, `body`, `url` fields.

Run: `node dist/index.js bug-cli --title "Test CLI issue" --format json`
Expected: JSON output with `repo`, `title`, `body`, `url` fields.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(bug): register bug and bug-cli commands in CLI entry"
```

---

### Task 7: E2E tests

**Files:**
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Build first**

Run: `npm run build`

- [ ] **Step 2: Add e2e tests**

Append to `src/__tests__/cli.test.ts` inside the `describe('CLI e2e', ...)` block:

```typescript
  // antd bug command
  it('should preview a bug report as text', () => {
    const out = run('bug', '--title', 'Test bug');
    expect(out).toContain('Repository: ant-design/ant-design');
    expect(out).toContain('Title: Test bug');
    expect(out).toContain('--- Issue Body ---');
    expect(out).toContain('### Reproduction link');
    expect(out).toContain('To submit, re-run with --submit flag.');
  });

  it('should preview a bug report as JSON', () => {
    const out = run('bug', '--title', 'Test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design');
    expect(data.title).toBe('Test bug');
    expect(data.body).toContain('<!-- generated by @ant-design/cli');
    expect(data.url).toContain('https://github.com/ant-design/ant-design/issues/new');
  });

  it('should include provided fields in bug report', () => {
    const out = run('bug', '--title', 'Test', '--steps', 'Click button', '--expected', 'Works', '--actual', 'Crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toContain('Click button');
    expect(data.body).toContain('Works');
    expect(data.body).toContain('Crashes');
  });

  it('should preview bug report as markdown (raw body)', () => {
    const out = run('bug', '--title', 'Test', '--format', 'markdown');
    expect(out).toContain('<!-- generated by @ant-design/cli');
    expect(out).not.toContain('Repository:');
  });

  it('should error when --title is missing for bug', () => {
    const result = runWithStatus('bug');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('--title');
  });

  // antd bug-cli command
  it('should preview a bug-cli report as text', () => {
    const out = run('bug-cli', '--title', 'CLI test bug');
    expect(out).toContain('Repository: ant-design/ant-design-cli');
    expect(out).toContain('Title: CLI test bug');
    expect(out).toContain('### Description');
  });

  it('should preview a bug-cli report as JSON', () => {
    const out = run('bug-cli', '--title', 'CLI test bug', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.repo).toBe('ant-design/ant-design-cli');
    expect(data.title).toBe('CLI test bug');
    expect(data.body).toContain('### Description');
    expect(data.body).toContain('@ant-design/cli');
    expect(data.url).toContain('https://github.com/ant-design/ant-design-cli/issues/new');
  });

  it('should include description in bug-cli report', () => {
    const out = run('bug-cli', '--title', 'Test', '--description', 'Info crashes', '--format', 'json');
    const data = JSON.parse(out);
    expect(data.body).toContain('Info crashes');
  });
```

- [ ] **Step 3: Build and run e2e tests**

Run: `npm run build && npx vitest run src/__tests__/cli.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Run full test suite**

Run: `npm run build && npm run test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/cli.test.ts
git commit -m "test(bug): add e2e tests for bug and bug-cli commands"
```

---

### Task 8: Update skill file

**Files:**
- Modify: `skills/antd/SKILL.md` (currently on `docs/agent-skill` branch — create file on `main`)

- [ ] **Step 1: Create skill file on main branch**

The skill file exists on the `docs/agent-skill` branch. Copy its content to main and add the new scenario:

```bash
mkdir -p skills/antd
git show origin/docs/agent-skill:skills/antd/SKILL.md > skills/antd/SKILL.md
```

Then edit `skills/antd/SKILL.md` to add the following:

In the YAML frontmatter `allowed-tools`, add:
```yaml
  - Bash(antd bug*)
  - Bash(antd bug-cli*)
```

Add a new section after "### 7. Exploring available components":

```markdown
### 8. Reporting issues

When you encounter a confirmed antd or CLI bug that can't be resolved locally, use the agentic feedback flow:

**Workflow:**
1. First diagnose using `antd doctor`, `antd info`, `antd lint`
2. If it's a genuine bug, assemble the report and preview it:

```bash
# Preview antd bug report for user review
antd bug --title "DatePicker crashes when selecting date" \
  --reproduction "https://codesandbox.io/s/xxx" \
  --steps "1. Open DatePicker 2. Click a date" \
  --expected "Date is selected" \
  --actual "Component crashes with error" \
  --format json

# Preview CLI bug report for user review
antd bug-cli --title "antd info shows wrong props for Select" \
  --description "Running antd info Select shows incorrect data" \
  --steps "1. Run antd info Select --version 5.0.0" \
  --expected "Shows 5.0.0 props" \
  --actual "Shows latest props instead" \
  --format json
```

3. Show the assembled issue content to the user and ask for confirmation
4. After user confirms, submit:

```bash
# Submit antd bug
antd bug --title "DatePicker crashes when selecting date" \
  --reproduction "https://codesandbox.io/s/xxx" \
  --steps "1. Open DatePicker 2. Click a date" \
  --expected "Date is selected" \
  --actual "Component crashes with error" \
  --submit

# Submit CLI bug
antd bug-cli --title "antd info shows wrong props for Select" \
  --description "Running antd info Select shows incorrect data" \
  --steps "1. Run antd info Select --version 5.0.0" \
  --expected "Shows 5.0.0 props" \
  --actual "Shows latest props instead" \
  --submit
```

**Key rules:**
- Always diagnose first before reporting — don't report issues that can be resolved locally
- Always preview and get user confirmation before submitting with `--submit`
- Include reproduction links when possible for antd bugs
- Provide clear, specific steps to reproduce
```

Also update the Key Rules section (add rule 6):

```markdown
6. **Report bugs through the CLI** — When you encounter an antd or CLI bug that can't be resolved, use `antd bug` / `antd bug-cli` to report it. Always preview first, get user confirmation, then submit.
```

- [ ] **Step 2: Verify the file**

Run: `cat skills/antd/SKILL.md | head -20`
Expected: YAML frontmatter with correct allowed-tools including bug commands.

- [ ] **Step 3: Commit**

```bash
git add skills/antd/SKILL.md
git commit -m "docs: add bug reporting scenario to agent skill file"
```

---

### Task 9: Update spec.md

**Files:**
- Modify: `spec.md`

- [ ] **Step 1: Update command count**

In `spec.md`, change `## Commands (12)` to `## Commands (14)`.

- [ ] **Step 2: Add a new section**

After the "Project Analysis (4)" section, add a new section:

```markdown
### Issue Reporting (2)

#### `antd bug`

Report a bug to the antd repository (`ant-design/ant-design`). Auto-collects environment info and generates issue content in the antd-issue-helper format.

```bash
antd bug --title "DatePicker crashes with dayjs 2.0"
antd bug --title "..." --steps "1. Click button" --expected "Works" --actual "Crashes"
antd bug --title "..." --reproduction "https://codesandbox.io/s/xxx"
antd bug --title "..." --submit          # submit via gh CLI
antd bug --title "..." --format json     # structured output for agent preview
```

Preview mode (default) outputs the assembled issue for review. `--submit` creates the issue via `gh issue create`. Returns error `GH_NOT_FOUND` if `gh` is not available.

JSON output (preview):
```json
{
  "repo": "ant-design/ant-design",
  "title": "DatePicker crashes",
  "body": "<!-- generated by @ant-design/cli... -->",
  "url": "https://github.com/ant-design/ant-design/issues/new?..."
}
```

#### `antd bug-cli`

Report a bug to the CLI repository (`ant-design/ant-design-cli`). Same interface as `antd bug` but with `--description` instead of `--reproduction`, targeting the CLI repo.

```bash
antd bug-cli --title "antd info crashes on v4 components"
antd bug-cli --title "..." --description "Detailed description..."
antd bug-cli --title "..." --submit
```
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add spec.md
git commit -m "docs: update spec.md with bug and bug-cli commands (14 commands)"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Manual smoke test**

Run: `node dist/index.js bug --title "Test" --steps "1. Do thing" --format json`
Verify JSON output has all expected fields.

Run: `node dist/index.js bug-cli --title "Test" --description "CLI issue" --format json`
Verify JSON output has all expected fields.

Run: `node dist/index.js --help`
Verify `bug` and `bug-cli` appear in the help output.

- [ ] **Step 5: Commit any remaining fixes**

If any issues found in verification, fix and commit.
