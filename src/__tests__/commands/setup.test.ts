import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCLI } from '../helper.js';

function withTempProject<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'antd-cli-setup-'));
  return fn(dir).finally(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('setup command', () => {
  it('previews Claude Code MCP config without writing files in dry run mode', async () => {
    await withTempProject(async (dir) => {
      const result = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--dry-run',
        '--format',
        'json',
        '--version',
        '5.29.3',
        '--lang',
        'zh',
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(dir, '.mcp.json'))).toBe(false);

      const data = JSON.parse(result.stdout);
      expect(data.client).toBe('claude');
      expect(data.dryRun).toBe(true);
      expect(data.changed).toBe(true);
      expect(data.file).toBe(join(dir, '.mcp.json'));
      expect(data.config.mcpServers.antd).toEqual({
        command: 'npx',
        args: ['-y', '@ant-design/cli', 'mcp', '--version', '5.29.3', '--lang', 'zh'],
      });
    });
  });

  it('does not report a dry run write when setup is already current', async () => {
    await withTempProject(async (dir) => {
      await runCLI('setup', '--client', 'claude', '--project', dir);

      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--dry-run');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Already configured: ${join(dir, '.mcp.json')}`);
      expect(result.stdout).not.toContain('Would write');
    });
  });

  it('writes Cursor MCP config while preserving existing servers', async () => {
    await withTempProject(async (dir) => {
      const cursorDir = join(dir, '.cursor');
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, 'mcp.json'), JSON.stringify({
        mcpServers: {
          existing: { command: 'node', args: ['server.js'] },
        },
      }));

      const result = await runCLI('setup', '--client', 'cursor', '--project', dir, '--format', 'json');

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data.changed).toBe(true);

      const config = readJson(join(cursorDir, 'mcp.json'));
      expect(config.mcpServers.existing).toEqual({ command: 'node', args: ['server.js'] });
      expect(config.mcpServers.antd).toEqual({
        command: 'npx',
        args: ['-y', '@ant-design/cli', 'mcp'],
      });
    });
  });

  it('writes VS Code MCP config using the servers key', async () => {
    await withTempProject(async (dir) => {
      const result = await runCLI('setup', '--client', 'vscode', '--project', dir, '--format', 'json');

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data.file).toBe(join(dir, '.vscode', 'mcp.json'));

      const config = readJson(join(dir, '.vscode', 'mcp.json'));
      expect(config.servers.antd).toEqual({
        command: 'npx',
        args: ['-y', '@ant-design/cli', 'mcp'],
      });
    });
  });

  it('rejects prototype property names as unsupported clients', async () => {
    await withTempProject(async (dir) => {
      const result = await runCLI('setup', '--client', 'toString', '--project', dir, '--format', 'json');

      expect(result.exitCode).toBe(1);
      const err = JSON.parse(result.stderr);
      expect(err.code).toBe('INVALID_ARGUMENT');
      expect(err.message).toContain("Unsupported agent client 'toString'");
    });
  });

  it('treats an empty existing config file as an empty config', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, '.mcp.json'), '   \n');

      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--format', 'json');

      expect(result.exitCode).toBe(0);
      expect(readJson(join(dir, '.mcp.json')).mcpServers.antd).toEqual({
        command: 'npx',
        args: ['-y', '@ant-design/cli', 'mcp'],
      });
    });
  });

  it('treats a non-object existing config file as an empty config', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, '.mcp.json'), '[]');

      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--format', 'json');

      expect(result.exitCode).toBe(0);
      expect(readJson(join(dir, '.mcp.json')).mcpServers.antd).toEqual({
        command: 'npx',
        args: ['-y', '@ant-design/cli', 'mcp'],
      });
    });
  });

  it('reports invalid JSON config files as setup errors', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, '.mcp.json'), '{');

      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--format', 'json');

      expect(result.exitCode).toBe(1);
      const error = JSON.parse(result.stderr);
      expect(error.code).toBe('INVALID_ARGUMENT');
      expect(error.message).toContain('Failed to configure agent');
      expect(error.suggestion).toContain('valid JSON');
    });
  });

  it('checks whether the agent MCP config is already installed', async () => {
    await withTempProject(async (dir) => {
      const missing = await runCLI('setup', '--client', 'claude', '--project', dir, '--check', '--format', 'json');
      expect(missing.exitCode).toBe(1);
      const missingData = JSON.parse(missing.stdout);
      expect(missingData.configured).toBe(false);
      expect(missingData.problems).toContain('Config file not found');

      await runCLI('setup', '--client', 'claude', '--project', dir);

      const configured = await runCLI('setup', '--client', 'claude', '--project', dir, '--check', '--format', 'json');
      expect(configured.exitCode).toBe(0);
      const configuredData = JSON.parse(configured.stdout);
      expect(configuredData.configured).toBe(true);
      expect(configuredData.problems).toEqual([]);
    });
  });

  it('reports MCP check problems in text output', async () => {
    await withTempProject(async (dir) => {
      const missing = await runCLI('setup', '--client', 'claude', '--project', dir, '--check');
      expect(missing.exitCode).toBe(1);
      expect(missing.stdout).toContain(`Not configured: ${join(dir, '.mcp.json')}`);
      expect(missing.stdout).toContain('- Config file not found');

      await runCLI('setup', '--client', 'claude', '--project', dir);
      const configured = await runCLI('setup', '--client', 'claude', '--project', dir, '--check');

      expect(configured.exitCode).toBe(0);
      expect(configured.stdout).toContain(`Configured: ${join(dir, '.mcp.json')}`);
    });
  });

  it('checks MCP config semantically regardless of key order', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
        mcpServers: {
          antd: {
            args: ['-y', '@ant-design/cli', 'mcp'],
            command: 'npx',
          },
        },
      }));

      const configured = await runCLI('setup', '--client', 'claude', '--project', dir, '--check', '--format', 'json');

      expect(configured.exitCode).toBe(0);
      expect(JSON.parse(configured.stdout).configured).toBe(true);
    });
  });

  it('reports malformed MCP server containers and entries during check', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: [] }));

      const missingEntry = await runCLI('setup', '--client', 'claude', '--project', dir, '--check', '--format', 'json');
      expect(missingEntry.exitCode).toBe(1);
      expect(JSON.parse(missingEntry.stdout).problems).toContain('Ant Design MCP server not configured');

      writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { antd: [] } }));
      const malformedEntry = await runCLI('setup', '--client', 'claude', '--project', dir, '--check', '--format', 'json');

      expect(malformedEntry.exitCode).toBe(1);
      expect(JSON.parse(malformedEntry.stdout).problems).toContain('Ant Design MCP server config does not match expected config');
    });
  });

  it('renders setup and check markdown output', async () => {
    await withTempProject(async (dir) => {
      const setupResult = await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'both', '--format', 'markdown');

      expect(setupResult.exitCode).toBe(0);
      expect(setupResult.stdout).toContain('## Setup Agent');
      expect(setupResult.stdout).toContain('| Client | claude |');
      expect(setupResult.stdout).toContain('| Mode | both |');
      expect(setupResult.stdout).toContain('| Instructions Changed | true |');

      const checkResult = await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'both', '--check', '--format', 'markdown');
      expect(checkResult.exitCode).toBe(0);
      expect(checkResult.stdout).toContain('## Setup Agent Check');
      expect(checkResult.stdout).toContain('| Configured | true |');
      expect(checkResult.stdout).toContain('| Problems | - |');
    });
  });

  it('rejects unsupported setup modes', async () => {
    await withTempProject(async (dir) => {
      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'invalid', '--format', 'json');

      expect(result.exitCode).toBe(1);
      const error = JSON.parse(result.stderr);
      expect(error.code).toBe('INVALID_ARGUMENT');
      expect(error.message).toContain("Unsupported setup mode 'invalid'");
    });
  });

  it('writes idempotent AGENTS.md instructions when requested', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, 'AGENTS.md'), '# Project Instructions\n\nKeep this line.\n');

      const result = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--write-instructions',
        '--format',
        'json',
      );
      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data.instructionsChanged).toBe(true);
      expect(data.instructionsFile).toBe(join(dir, 'AGENTS.md'));

      const first = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(first).toContain('Keep this line.');
      expect(first).toContain('<!-- antd-cli setup start -->');
      expect(first).toContain('use the configured `antd` MCP server');
      expect(first.match(/antd-cli setup start/g)).toHaveLength(1);

      const secondRun = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--write-instructions',
        '--format',
        'json',
      );
      expect(secondRun.exitCode).toBe(0);
      const secondData = JSON.parse(secondRun.stdout);
      expect(secondData.instructionsChanged).toBe(false);
      const second = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(second.match(/antd-cli setup start/g)).toHaveLength(1);
    });
  });

  it('supports skill mode without writing MCP config', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, 'CLAUDE.md'), '# Claude Instructions\n');

      const result = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--mode',
        'skill',
        '--format',
        'json',
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(dir, '.mcp.json'))).toBe(false);

      const data = JSON.parse(result.stdout);
      expect(data.mode).toBe('skill');
      expect(data.changed).toBe(false);
      expect(data.skillChanged).toBe(true);
      expect(data.skillDir).toBe(join(dir, 'skills', 'antd'));
      expect(data.instructionsChanged).toBe(true);
      expect(data.instructionsFile).toBe(join(dir, 'CLAUDE.md'));

      expect(existsSync(join(dir, '.mcp.json'))).toBe(false);
      expect(readFileSync(join(dir, 'skills', 'antd', 'SKILL.md'), 'utf-8')).toContain('name: antd');

      const instructions = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
      expect(instructions).toContain('Use the local Ant Design skill at `skills/antd/SKILL.md`');
    });
  });

  it('prints the instructions file when only skill instructions change in text mode', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, 'CLAUDE.md'), '# Claude Instructions\n');
      await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'skill');

      writeFileSync(join(dir, 'CLAUDE.md'), '# Claude Instructions\n');

      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'skill');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(join(dir, 'CLAUDE.md'));
      expect(result.stdout).not.toContain(join(dir, '.mcp.json'));
    });
  });

  it('supports both mode by writing MCP config and AGENTS.md instructions', async () => {
    await withTempProject(async (dir) => {
      const result = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--mode',
        'both',
        '--format',
        'json',
      );

      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data.mode).toBe('both');
      expect(data.changed).toBe(true);
      expect(data.skillChanged).toBe(true);
      expect(data.instructionsChanged).toBe(true);
      expect(readJson(join(dir, '.mcp.json')).mcpServers.antd).toEqual({
        command: 'npx',
        args: ['-y', '@ant-design/cli', 'mcp'],
      });
      expect(readFileSync(join(dir, 'skills', 'antd', 'SKILL.md'), 'utf-8')).toContain('name: antd');
      expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain('Use the local Ant Design skill at `skills/antd/SKILL.md`');
    });
  });

  it('prints every changed target in text mode when multiple files are written', async () => {
    await withTempProject(async (dir) => {
      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'both');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Wrote: ${join(dir, '.mcp.json')}`);
      expect(result.stdout).toContain(`Wrote: ${join(dir, 'skills', 'antd')}`);
      expect(result.stdout).toContain(`Wrote: ${join(dir, 'AGENTS.md')}`);
    });
  });

  it('prints Wrote when only the skill directory changes', async () => {
    await withTempProject(async (dir) => {
      await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'skill');
      rmSync(join(dir, 'skills'), { recursive: true, force: true });

      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'skill');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Wrote: ${join(dir, 'skills', 'antd')}`);
      expect(result.stdout).not.toContain('Already configured');
    });
  });

  it('checks MCP instructions when --check is combined with --write-instructions', async () => {
    await withTempProject(async (dir) => {
      await runCLI('setup', '--client', 'claude', '--project', dir);

      const missingInstructions = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--check',
        '--write-instructions',
        '--format',
        'json',
      );

      expect(missingInstructions.exitCode).toBe(1);
      expect(JSON.parse(missingInstructions.stdout).problems).toContain('MCP instructions not found');

      await runCLI('setup', '--client', 'claude', '--project', dir, '--write-instructions');
      const configured = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--check',
        '--write-instructions',
        '--format',
        'json',
      );

      expect(configured.exitCode).toBe(0);
      expect(JSON.parse(configured.stdout).configured).toBe(true);
    });
  });

  it('checks instructions in the same file setup would write', async () => {
    await withTempProject(async (dir) => {
      writeFileSync(join(dir, 'CLAUDE.md'), '# Claude Instructions\n');
      writeFileSync(join(dir, 'AGENTS.md'), '# Project Instructions\n');
      await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'both');
      const agentsWithInstructions = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
      writeFileSync(join(dir, 'CLAUDE.md'), '# Claude Instructions\n');
      writeFileSync(join(dir, 'AGENTS.md'), agentsWithInstructions);

      const result = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--mode',
        'both',
        '--check',
        '--format',
        'json',
      );

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).problems).toContain('Skill instructions do not match expected instructions');
    });
  });

  it('checks skill mode installation and instructions', async () => {
    await withTempProject(async (dir) => {
      const missing = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--mode',
        'skill',
        '--check',
        '--format',
        'json',
      );
      expect(missing.exitCode).toBe(1);
      const missingData = JSON.parse(missing.stdout);
      expect(missingData.problems).toContain('Ant Design skill not installed');
      expect(missingData.problems).toContain('Skill instructions not found');

      await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'skill');

      const configured = await runCLI(
        'setup',
        '--client',
        'claude',
        '--project',
        dir,
        '--mode',
        'skill',
        '--check',
        '--format',
        'json',
      );
      expect(configured.exitCode).toBe(0);
      expect(JSON.parse(configured.stdout).configured).toBe(true);
    });
  });

  it('reports a mismatched installed skill', async () => {
    await withTempProject(async (dir) => {
      await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'skill');
      writeFileSync(join(dir, 'skills', 'antd', 'SKILL.md'), 'name: stale\n');

      const result = await runCLI('setup', '--client', 'claude', '--project', dir, '--mode', 'skill', '--check', '--format', 'json');

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).problems).toContain('Ant Design skill does not match bundled skill');
    });
  });

  it('does not try to copy the bundled skill onto itself during dry run', async () => {
    const result = await runCLI('setup', '--client', 'claude', '--project', process.cwd(), '--mode', 'skill', '--dry-run', '--format', 'json');

    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.skillDir).toBe(join(process.cwd(), 'skills', 'antd'));
    expect(data.skillChanged).toBe(false);
  });
});
