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

import { collectAntdEnv, collectCliEnv } from '../utils/issue.js';

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
