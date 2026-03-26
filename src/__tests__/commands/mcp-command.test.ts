import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerMcpCommand } from '../../commands/mcp.js';

describe('registerMcpCommand', () => {
  it('should register the mcp command', () => {
    const program = new Command();
    registerMcpCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'mcp');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('MCP');
  });
});
