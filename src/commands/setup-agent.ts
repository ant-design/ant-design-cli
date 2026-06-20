import type { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { GlobalOptions, OutputFormat } from '../types.js';
import { localize } from '../types.js';
import { output } from '../output/formatter.js';
import { createError, ErrorCodes, printError } from '../output/error.js';

type AgentClient = 'claude' | 'cursor' | 'vscode';

interface SetupAgentOptions {
  client: AgentClient;
  project: string;
  dryRun?: boolean;
  check?: boolean;
  writeInstructions?: boolean;
}

interface ClientConfig {
  client: AgentClient;
  file: string;
  serverKey: 'mcpServers' | 'servers';
}

interface SetupAgentResult {
  client: AgentClient;
  file: string;
  changed: boolean;
  dryRun: boolean;
  config: Record<string, unknown>;
  instructionsFile?: string;
  instructionsChanged?: boolean;
}

interface CheckAgentResult {
  client: AgentClient;
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

const INSTRUCTIONS_START = '<!-- antd-cli setup-agent start -->';
const INSTRUCTIONS_END = '<!-- antd-cli setup-agent end -->';

function isAgentClient(value: string): value is AgentClient {
  return value in CLIENTS;
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
  return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
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

function createInstructionsBlock(): string {
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

function writeInstructions(projectDir: string, dryRun: boolean): { file: string; changed: boolean } {
  const file = join(projectDir, 'AGENTS.md');
  const current = existsSync(file) ? readFileSync(file, 'utf-8') : '';
  const block = createInstructionsBlock();
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

function getServerEntry(config: Record<string, unknown>, serverKey: 'mcpServers' | 'servers'): unknown {
  const servers = config[serverKey];
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return undefined;
  return (servers as Record<string, unknown>).antd;
}

function checkAgent(client: AgentClient, projectDir: string, globalOpts: GlobalOptions): CheckAgentResult {
  const clientConfig = CLIENTS[client];
  const file = resolve(projectDir, clientConfig.file);
  const expectedConfig = createMergedConfig({}, clientConfig.serverKey, globalOpts);
  const expected = getServerEntry(expectedConfig, clientConfig.serverKey) as Record<string, unknown>;
  const problems: string[] = [];
  let actual: unknown;

  if (!existsSync(file)) {
    problems.push('Config file not found');
  } else {
    const current = readConfig(file);
    actual = getServerEntry(current, clientConfig.serverKey);
    if (!actual) {
      problems.push('Ant Design MCP server not configured');
    } else if (stableJson(actual) !== stableJson(expected)) {
      problems.push('Ant Design MCP server config does not match expected config');
    }
  }

  return {
    client,
    file,
    configured: problems.length === 0,
    problems,
    expected,
    actual,
  };
}

function formatSetupAgentMarkdown(result: SetupAgentResult, lang: string): string {
  return [
    `## ${localize('Setup Agent', '配置 Agent', lang)}`,
    '',
    `| ${localize('Field', '字段', lang)} | ${localize('Value', '值', lang)} |`,
    '|---|---|',
    `| ${localize('Client', '客户端', lang)} | ${result.client} |`,
    `| ${localize('File', '文件', lang)} | ${result.file} |`,
    `| ${localize('Changed', '已变更', lang)} | ${String(result.changed)} |`,
    `| ${localize('Dry Run', '预览模式', lang)} | ${String(result.dryRun)} |`,
  ].join('\n');
}

function printSetupAgentResult(result: SetupAgentResult | CheckAgentResult, format: OutputFormat, lang: string): void {
  if (format === 'json') {
    output(result, 'json');
    return;
  }
  if (format === 'markdown') {
    if ('configured' in result) {
      console.log(formatCheckAgentMarkdown(result, lang));
    } else {
      console.log(formatSetupAgentMarkdown(result, lang));
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

  const action = result.dryRun
    ? localize('Would write', '将写入', lang)
    : result.changed
      ? localize('Wrote', '已写入', lang)
      : localize('Already configured', '已配置', lang);
  console.log(`${action}: ${result.file}`);
}

function formatCheckAgentMarkdown(result: CheckAgentResult, lang: string): string {
  return [
    `## ${localize('Setup Agent Check', 'Agent 配置检查', lang)}`,
    '',
    `| ${localize('Field', '字段', lang)} | ${localize('Value', '值', lang)} |`,
    '|---|---|',
    `| ${localize('Client', '客户端', lang)} | ${result.client} |`,
    `| ${localize('File', '文件', lang)} | ${result.file} |`,
    `| ${localize('Configured', '已配置', lang)} | ${String(result.configured)} |`,
    `| ${localize('Problems', '问题', lang)} | ${result.problems.join('; ') || '-'} |`,
  ].join('\n');
}

export function setupAgent(
  client: AgentClient,
  projectDir: string,
  globalOpts: GlobalOptions,
  dryRun = false,
  shouldWriteInstructions = false,
): SetupAgentResult {
  const clientConfig = CLIENTS[client];
  const file = resolve(projectDir, clientConfig.file);
  const current = readConfig(file);
  const config = createMergedConfig(current, clientConfig.serverKey, globalOpts);
  const changed = stableJson(current) !== stableJson(config);
  let instructions: { file: string; changed: boolean } | undefined;

  if (!dryRun && changed) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, stableJson(config));
  }

  if (shouldWriteInstructions) {
    instructions = writeInstructions(projectDir, dryRun);
  }

  return {
    client,
    file,
    changed,
    dryRun,
    config,
    ...(instructions
      ? {
          instructionsFile: instructions.file,
          instructionsChanged: instructions.changed,
        }
      : {}),
  };
}

export function registerSetupAgentCommand(program: Command): void {
  program
    .command('setup-agent')
    .description('Configure an AI agent to use the Ant Design MCP server')
    .requiredOption('--client <client>', 'Agent client: claude, cursor, or vscode')
    .option('--project <dir>', 'Project directory to write config into', process.cwd())
    .option('--dry-run', 'Preview the config without writing files')
    .option('--check', 'Check whether the agent is already configured')
    .option('--write-instructions', 'Write AGENTS.md instructions for using the antd MCP server')
    .action((cmdOpts: SetupAgentOptions) => {
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

      try {
        const result = cmdOpts.check
          ? checkAgent(cmdOpts.client, cmdOpts.project, opts)
          : setupAgent(
              cmdOpts.client,
              cmdOpts.project,
              opts,
              Boolean(cmdOpts.dryRun),
              Boolean(cmdOpts.writeInstructions),
            );
        printSetupAgentResult(result, opts.format, opts.lang);
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
