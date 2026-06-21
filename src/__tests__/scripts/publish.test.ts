import { describe, expect, it } from 'vitest';
import { getPublishPlan } from '../../../scripts/publish.js';

describe('publish workflow plan', () => {
  it('commits synced data changes even when the CLI version is already published', () => {
    const plan = getPublishPlan({
      cliVersion: '6.4.4',
      oldVersion: '6.4.4',
      existingVersion: '6.4.4',
      changedFiles: new Set(['data/v5.json']),
    });

    expect(plan.shouldCommit).toBe(true);
    expect(plan.shouldPublish).toBe(false);
    expect(plan.shouldSkip).toBe(false);
  });

  it('skips when the published CLI version has no local changes', () => {
    const plan = getPublishPlan({
      cliVersion: '6.4.4',
      oldVersion: '6.4.4',
      existingVersion: '6.4.4',
      changedFiles: new Set(),
    });

    expect(plan.shouldCommit).toBe(false);
    expect(plan.shouldPublish).toBe(false);
    expect(plan.shouldSkip).toBe(true);
  });
});
