import type { Command } from 'commander';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GlobalOptions, OutputFormat } from '../types.js';
import { localize } from '../types.js';
import { output } from '../output/formatter.js';
import { createError, ErrorCodes, printError } from '../output/error.js';

type AgentClient = 'claude' | 'cursor' | 'vscode';
type SetupMode = 'mcp' | 'skill' | 'both';

interface SetupOptions {
  client: AgentClient;
  project: string;
  mode?: SetupMode;
  dryRun?: boolean;
  check?: boolean;
  writeInstructions?: boolean;
}

interface ClientConfig {
  client: AgentClient;
  file: string;
  serverKey: 'mcpServers' | 'servers';
}

interface SetupResult {
  client: AgentClient;
  mode: SetupMode;
  file: string;
  changed: boolean;
  dryRun: boolean;
  config: Record<string, unknown>;
  skillDir?: string;
  skillChanged?: boolean;
  instructionsFile?: string;
  instructionsChanged?: boolean;
}

interface CheckAgentResult {
  client: AgentClient;
  mode: SetupMode;
  file: string;
  configured: boolean;
  problems: string[];
  expected: Record<string, unknown>;
  actual?: unknown;
}

const CLIENTS: Record<AgentClient, Omit<ClientConfig, 'client' | 'file'> & { file: string }> = {
  claude: { file: '.mcp.json', serverKey: 'mcpServers' },
  cursor: { file: '.cursor/mcp.json', serverKey: 'mcpServers' },
  vscode: { file: '.vscode/mcp.json', serverKey: 'servers' },
};

const INSTRUCTIONS_START = '<!-- antd-cli setup start -->';
const INSTRUCTIONS_END = '<!-- antd-cli setup end -->';

function isAgentClient(value: string): value is AgentClient {
  return Object.prototype.hasOwnProperty.call(CLIENTS, value);
}

function isSetupMode(value: string): value is SetupMode {
  return value === 'mcp' || value === 'skill' || value === 'both';
}

function buildMcpArgs(opts: GlobalOptions): string[] {
  const args = ['-y', '@ant-design/cli', 'mcp'];
  if (opts.version) {
    args.push('--version', opts.version);
  }
  if (opts.lang && opts.lang !== 'en') {
    args.push('--lang', opts.lang);
  }
  return args;
}

function readConfig(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {};
  const content = readFileSync(file, 'utf-8').trim();
  if (!content) return {};
  const parsed = JSON.parse(content) as unknown;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function createMergedConfig(
  current: Record<string, unknown>,
  serverKey: 'mcpServers' | 'servers',
  globalOpts: GlobalOptions,
): Record<string, unknown> {
  const existingServers = current[serverKey];
  const servers = existingServers && typeof existingServers === 'object' && !Array.isArray(existingServers)
    ? existingServers as Record<string, unknown>
    : {};

  return {
    ...current,
    [serverKey]: {
      ...servers,
      antd: {
        command: 'npx',
        args: buildMcpArgs(globalOpts),
      },
    },
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function createMcpInstructionsBlock(): string {
  return [
    INSTRUCTIONS_START,
    '## Ant Design CLI MCP',
    '',
    'When working with Ant Design in this repository, use the configured `antd` MCP server before writing component code:',
    '',
    '- Use `antd_info` for component props, defaults, common props, and native HTML element hints.',
    '- Use `antd_doc` when you need the full component API documentation.',
    '- Use `antd_demo` before generating non-trivial usage examples.',
    '- Use `antd_token` and `antd_design_md` for theme, token, and design-language work.',
    '- Use `antd_semantic` when customizing `classNames` or `styles` slots.',
    '- Use `antd_changelog` for version migration or API-diff questions.',
    '',
    INSTRUCTIONS_END,
  ].join('\n');
}

function getSkillDir(projectDir: string, client: AgentClient): string {
  return client === 'claude'
    ? join(projectDir, '.claude', 'skills', 'antd')
    : join(projectDir, 'skills', 'antd');
}

function getSkillInstructionsPath(client: AgentClient): string {
  return client === 'claude'
    ? '.claude/skills/antd/SKILL.md'
    : 'skills/antd/SKILL.md';
}

function createSkillInstructionsBlock(client: AgentClient): string {
  const skillPath = getSkillInstructionsPath(client);
  const label = client === 'claude' ? 'installed Ant Design skill' : 'local Ant Design skill reference';
  return [
    INSTRUCTIONS_START,
    '## Ant Design CLI Skill',
    '',
    `Use the ${label} at \`${skillPath}\` before working on Ant Design code in this repository.`,
    '',
    'The skill teaches agents when and how to call `@ant-design/cli` commands such as `antd info`, `antd doc`, `antd demo`, `antd token`, `antd semantic`, and `antd changelog`.',
    '',
    INSTRUCTIONS_END,
  ].join('\n');
}

function createInstructionsBlock(mode: SetupMode, client: AgentClient): string {
  if (mode === 'skill') return createSkillInstructionsBlock(client);
  if (mode === 'both') {
    const skillPath = getSkillInstructionsPath(client);
    const label = client === 'claude' ? 'installed Ant Design skill' : 'local Ant Design skill reference';
    return createMcpInstructionsBlock().replace(
      INSTRUCTIONS_END,
      [
        `Use the ${label} at \`${skillPath}\` for CLI fallback guidance and project-local agent instructions.`,
        '',
        INSTRUCTIONS_END,
      ].join('\n'),
    );
  }
  return createMcpInstructionsBlock();
}

function chooseInstructionsFile(projectDir: string, client: AgentClient): string {
  return join(projectDir, client === 'claude' ? 'CLAUDE.md' : 'AGENTS.md');
}

function writeInstructions(projectDir: string, dryRun: boolean, mode: SetupMode, client: AgentClient): { file: string; changed: boolean } {
  const file = chooseInstructionsFile(projectDir, client);
  const current = existsSync(file) ? readFileSync(file, 'utf-8') : '';
  const block = createInstructionsBlock(mode, client);
  const pattern = new RegExp(`${INSTRUCTIONS_START}[\\s\\S]*?${INSTRUCTIONS_END}`);
  const next = pattern.test(current)
    ? current.replace(pattern, block)
    : `${current.trimEnd()}${current.trimEnd() ? '\n\n' : ''}${block}\n`;
  const changed = current !== next;

  if (!dryRun && changed) {
    writeFileSync(file, next);
  }

  return { file, changed };
}

function resolveBundledSkillDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../skills/antd'),
    resolve(here, '../skills/antd'),
    resolve(process.cwd(), 'skills/antd'),
  ];

  const found = candidates.find((dir) => existsSync(join(dir, 'SKILL.md')));
  /* v8 ignore next 3 -- package.json includes skills/antd; this only guards broken installs */
  if (!found) {
    throw new Error('Bundled Ant Design skill not found');
  }
  return found;
}

function installSkill(projectDir: string, dryRun: boolean, client: AgentClient): { dir: string; changed: boolean } {
  const source = resolveBundledSkillDir();
  const target = getSkillDir(projectDir, client);
  const sourceSkill = join(source, 'SKILL.md');
  const targetSkill = join(target, 'SKILL.md');

  if (resolve(source) === resolve(target)) {
    return { dir: target, changed: false };
  }

  const changed = !existsSync(targetSkill) || readFileSync(sourceSkill, 'utf-8') !== readFileSync(targetSkill, 'utf-8');
  if (changed && !dryRun) {
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, force: true });
  }

  return { dir: target, changed };
}

function getServerEntry(config: Record<string, unknown>, serverKey: 'mcpServers' | 'servers'): unknown {
  const servers = config[serverKey];
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return undefined;
  return (servers as Record<string, unknown>).antd;
}

function isMatchingServerEntry(actual: unknown, expected: Record<string, unknown>): boolean {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const entry = actual as Record<string, unknown>;
  const expectedArgs = expected.args;
  return entry.command === expected.command
    && Array.isArray(entry.args)
    && Array.isArray(expectedArgs)
    && entry.args.length === expectedArgs.length
    && entry.args.every((arg, index) => arg === expectedArgs[index]);
}

function checkInstructions(projectDir: string, mode: SetupMode, client: AgentClient): string[] {
  const expected = createInstructionsBlock(mode, client);
  const file = chooseInstructionsFile(projectDir, client);

  if (!existsSync(file)) {
    return [mode === 'mcp' ? 'MCP instructions not found' : 'Skill instructions not found'];
  }
  if (!readFileSync(file, 'utf-8').includes(expected)) {
    return [mode === 'mcp' ? 'MCP instructions do not match expected instructions' : 'Skill instructions do not match expected instructions'];
  }
  return [];
}

function checkSkill(projectDir: string, client: AgentClient): string[] {
  const source = resolveBundledSkillDir();
  const sourceSkill = join(source, 'SKILL.md');
  const targetSkill = join(getSkillDir(projectDir, client), 'SKILL.md');

  if (!existsSync(targetSkill)) return ['Ant Design skill not installed'];
  if (readFileSync(sourceSkill, 'utf-8') !== readFileSync(targetSkill, 'utf-8')) {
    return ['Ant Design skill does not match bundled skill'];
  }
  return [];
}

function checkAgent(
  client: AgentClient,
  projectDir: string,
  globalOpts: GlobalOptions,
  mode: SetupMode,
  shouldCheckInstructions = false,
): CheckAgentResult {
  const clientConfig = CLIENTS[client];
  const file = resolve(projectDir, clientConfig.file);
  const expectedConfig = createMergedConfig({}, clientConfig.serverKey, globalOpts);
  const expected = getServerEntry(expectedConfig, clientConfig.serverKey) as Record<string, unknown>;
  const problems: string[] = [];
  let actual: unknown;

  if (mode === 'mcp' || mode === 'both') {
    if (!existsSync(file)) {
      problems.push('Config file not found');
    } else {
      const current = readConfig(file);
      actual = getServerEntry(current, clientConfig.serverKey);
      if (!actual) {
        problems.push('Ant Design MCP server not configured');
      } else if (!isMatchingServerEntry(actual, expected)) {
        problems.push('Ant Design MCP server config does not match expected config');
      }
    }
  }

  if (mode === 'skill' || mode === 'both') {
    problems.push(...checkSkill(projectDir, client));
  }

  if (mode === 'skill' || mode === 'both' || shouldCheckInstructions) {
    problems.push(...checkInstructions(projectDir, mode, client));
  }

  return {
    client,
    mode,
    file,
    configured: problems.length === 0,
    problems,
    expected,
    actual,
  };
}

function formatSetupMarkdown(result: SetupResult, lang: string): string {
  return [
    `## ${localize('Setup Agent', '配置 Agent', lang)}`,
    '',
    `| ${localize('Field', '字段', lang)} | ${localize('Value', '值', lang)} |`,
    '|---|---|',
    `| ${localize('Client', '客户端', lang)} | ${result.client} |`,
    `| ${localize('Mode', '模式', lang)} | ${result.mode} |`,
    `| ${localize('File', '文件', lang)} | ${result.file} |`,
    `| ${localize('Changed', '已变更', lang)} | ${String(result.changed)} |`,
    `| ${localize('Instructions Changed', '指令已变更', lang)} | ${String(result.instructionsChanged ?? false)} |`,
    `| ${localize('Dry Run', '预览模式', lang)} | ${String(result.dryRun)} |`,
  ].join('\n');
}

function printSetupResult(result: SetupResult | CheckAgentResult, format: OutputFormat, lang: string): void {
  if (format === 'json') {
    output(result, 'json');
    return;
  }
  if (format === 'markdown') {
    if ('configured' in result) {
      console.log(formatCheckAgentMarkdown(result, lang));
    } else {
      console.log(formatSetupMarkdown(result, lang));
    }
    return;
  }

  if ('configured' in result) {
    if (result.configured) {
      console.log(localize(`Configured: ${result.file}`, `已配置: ${result.file}`, lang));
    } else {
      console.log(localize(`Not configured: ${result.file}`, `未配置: ${result.file}`, lang));
      for (const problem of result.problems) {
        console.log(`- ${problem}`);
      }
    }
    return;
  }

  const changedTargets = [
    ...(result.changed ? [result.file] : []),
    ...(result.skillChanged && result.skillDir ? [result.skillDir] : []),
    ...(result.instructionsChanged && result.instructionsFile ? [result.instructionsFile] : []),
  ];
  const hasChanges = changedTargets.length > 0;
  const action = hasChanges
    ? result.dryRun
      ? localize('Would write', '将写入', lang)
      : localize('Wrote', '已写入', lang)
    : localize('Already configured', '已配置', lang);
  const targets = changedTargets.length > 0 ? changedTargets : [result.file];
  for (const target of targets) {
    console.log(`${action}: ${target}`);
  }
}

function formatCheckAgentMarkdown(result: CheckAgentResult, lang: string): string {
  return [
    `## ${localize('Setup Agent Check', 'Agent 配置检查', lang)}`,
    '',
    `| ${localize('Field', '字段', lang)} | ${localize('Value', '值', lang)} |`,
    '|---|---|',
    `| ${localize('Client', '客户端', lang)} | ${result.client} |`,
    `| ${localize('Mode', '模式', lang)} | ${result.mode} |`,
    `| ${localize('File', '文件', lang)} | ${result.file} |`,
    `| ${localize('Configured', '已配置', lang)} | ${String(result.configured)} |`,
    `| ${localize('Problems', '问题', lang)} | ${result.problems.join('; ') || '-'} |`,
  ].join('\n');
}

export function setup(
  client: AgentClient,
  projectDir: string,
  globalOpts: GlobalOptions,
  dryRun = false,
  mode: SetupMode = 'mcp',
  shouldWriteInstructions = false,
): SetupResult {
  const clientConfig = CLIENTS[client];
  const file = resolve(projectDir, clientConfig.file);
  const shouldWriteMcp = mode === 'mcp' || mode === 'both';
  const current = shouldWriteMcp ? readConfig(file) : {};
  const config = shouldWriteMcp ? createMergedConfig(current, clientConfig.serverKey, globalOpts) : {};
  const changed = shouldWriteMcp && stableJson(current) !== stableJson(config);
  let instructions: { file: string; changed: boolean } | undefined;
  let skill: { dir: string; changed: boolean } | undefined;

  if (!dryRun && changed) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, stableJson(config));
  }

  if (mode === 'skill' || mode === 'both') {
    skill = installSkill(projectDir, dryRun, client);
  }

  if (mode === 'skill' || mode === 'both' || shouldWriteInstructions) {
    instructions = writeInstructions(projectDir, dryRun, mode === 'mcp' ? 'mcp' : mode, client);
  }

  return {
    client,
    mode,
    file,
    changed,
    dryRun,
    config,
    ...(skill
      ? {
          skillDir: skill.dir,
          skillChanged: skill.changed,
        }
      : {}),
    ...(instructions
      ? {
          instructionsFile: instructions.file,
          instructionsChanged: instructions.changed,
        }
      : {}),
  };
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Set up Ant Design MCP/Skill for AI agents')
    .requiredOption('--client <client>', 'Agent client: claude, cursor, or vscode')
    .option('--mode <mode>', 'Setup mode: mcp, skill, or both', 'mcp')
    .option('--project <dir>', 'Project directory to write config into', process.cwd())
    .option('--dry-run', 'Preview the config without writing files')
    .option('--check', 'Check whether the agent is already configured')
    .option('--write-instructions', 'Write agent instructions for using the antd MCP server')
    .action((cmdOpts: SetupOptions) => {
      const opts = program.opts<GlobalOptions>();
      if (!isAgentClient(cmdOpts.client)) {
        const err = createError(
          ErrorCodes.INVALID_ARGUMENT,
          localize(
            `Unsupported agent client '${cmdOpts.client}'`,
            `不支持的 Agent 客户端 '${cmdOpts.client}'`,
            opts.lang,
          ),
          localize(
            'Use one of: claude, cursor, vscode.',
            '请使用: claude, cursor, vscode。',
            opts.lang,
          ),
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }
      if (!isSetupMode(cmdOpts.mode ?? 'mcp')) {
        const err = createError(
          ErrorCodes.INVALID_ARGUMENT,
          localize(
            `Unsupported setup mode '${cmdOpts.mode}'`,
            `不支持的配置模式 '${cmdOpts.mode}'`,
            opts.lang,
          ),
          localize(
            'Use one of: mcp, skill, both.',
            '请使用: mcp, skill, both。',
            opts.lang,
          ),
        );
        printError(err, opts.format);
        process.exitCode = 1;
        return;
      }

      const mode = cmdOpts.mode ?? 'mcp';

      try {
        const result = cmdOpts.check
          ? checkAgent(cmdOpts.client, cmdOpts.project, opts, mode, Boolean(cmdOpts.writeInstructions))
          : setup(
              cmdOpts.client,
              cmdOpts.project,
              opts,
              Boolean(cmdOpts.dryRun),
              mode,
              Boolean(cmdOpts.writeInstructions),
            );
        printSetupResult(result, opts.format, opts.lang);
        if ('configured' in result && !result.configured) {
          process.exitCode = 1;
        }
      } catch (error) {
        const err = createError(
          ErrorCodes.INVALID_ARGUMENT,
          localize(
            `Failed to configure agent: ${error instanceof Error ? error.message : String(error)}`,
            `配置 Agent 失败: ${error instanceof Error ? error.message : String(error)}`,
            opts.lang,
          ),
          localize(
            'Check that the target config file contains valid JSON.',
            '请检查目标配置文件是否为有效 JSON。',
            opts.lang,
          ),
        );
        printError(err, opts.format);
        process.exitCode = 1;
      }
    });
}
