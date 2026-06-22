import { describe, expect, it } from 'vitest';
import {
  getPublishPlan,
  getPublishSteps,
  isGithubReleaseNotFoundError,
  isNpmPackageNotFoundError,
} from '../../../scripts/publish.js';

describe('publish workflow plan', () => {
  it('commits synced data changes even when the CLI version is already published', () => {
    const plan = getPublishPlan({
      cliVersion: '6.4.4',
      oldVersion: '6.4.4',
      existingVersion: '6.4.4',
      existingGitTag: true,
      existingGithubRelease: true,
      changedFiles: new Set(['data/v5.json']),
    });

    expect(plan.shouldCommit).toBe(true);
    expect(plan.shouldPublish).toBe(false);
    expect(plan.shouldTag).toBe(false);
    expect(plan.shouldRelease).toBe(false);
    expect(plan.shouldSkip).toBe(false);
  });

  it('skips when the published CLI version has no local changes', () => {
    const plan = getPublishPlan({
      cliVersion: '6.4.4',
      oldVersion: '6.4.4',
      existingVersion: '6.4.4',
      existingGitTag: true,
      existingGithubRelease: true,
      changedFiles: new Set(),
    });

    expect(plan.shouldCommit).toBe(false);
    expect(plan.shouldPublish).toBe(false);
    expect(plan.shouldTag).toBe(false);
    expect(plan.shouldRelease).toBe(false);
    expect(plan.shouldSkip).toBe(true);
  });

  it('recovers a missing git tag and GitHub Release even when npm is already published', () => {
    const plan = getPublishPlan({
      cliVersion: '6.4.4',
      oldVersion: '6.4.4',
      existingVersion: '6.4.4',
      existingGitTag: false,
      existingGithubRelease: false,
      changedFiles: new Set(),
    });

    expect(plan.shouldCommit).toBe(false);
    expect(plan.shouldPublish).toBe(false);
    expect(plan.shouldTag).toBe(true);
    expect(plan.shouldRelease).toBe(true);
    expect(plan.shouldSkip).toBe(false);
  });

  it('recovers tag, release, and npm publish when package version already changed but publish failed', () => {
    const plan = getPublishPlan({
      cliVersion: '6.4.4',
      oldVersion: '6.4.4',
      existingVersion: null,
      existingGitTag: false,
      existingGithubRelease: false,
      changedFiles: new Set(),
    });

    expect(plan.shouldCommit).toBe(false);
    expect(plan.shouldPublish).toBe(true);
    expect(plan.shouldTag).toBe(true);
    expect(plan.shouldRelease).toBe(true);
    expect(plan.shouldSkip).toBe(false);
  });

  it('defaults omitted tag and release state to recovery when publish is needed', () => {
    const plan = getPublishPlan({
      cliVersion: '6.4.4',
      oldVersion: '6.4.4',
      existingVersion: null,
      changedFiles: new Set(),
    });

    expect(plan.shouldTag).toBe(true);
    expect(plan.shouldRelease).toBe(true);
  });

  it('only classifies missing GitHub releases as recoverable lookup misses', () => {
    expect(isGithubReleaseNotFoundError(new Error('release not found'))).toBe(true);
    expect(isGithubReleaseNotFoundError({ stderr: Buffer.from('HTTP 404: Not Found') })).toBe(true);
    expect(isGithubReleaseNotFoundError(new Error('HTTP 401: Bad credentials'))).toBe(false);
    expect(isGithubReleaseNotFoundError({ stderr: Buffer.from('sh: gh: command not found') })).toBe(false);
  });

  it('only classifies npm not-found errors as unpublished packages', () => {
    expect(isNpmPackageNotFoundError({ stderr: Buffer.from('npm ERR! code E404\nnpm ERR! 404 Not Found') })).toBe(true);
    expect(isNpmPackageNotFoundError(new Error('No match found for version 6.4.4'))).toBe(true);
    expect(isNpmPackageNotFoundError(new Error('network timeout'))).toBe(false);
    expect(isNpmPackageNotFoundError(new Error('npm ERR! code E401'))).toBe(false);
  });

  it('publishes to npm before creating a GitHub Release', () => {
    const steps = getPublishSteps({
      shouldCommit: true,
      shouldPublish: true,
      shouldTag: true,
      shouldRelease: true,
      shouldSkip: false,
    });

    expect(steps.indexOf('publish')).toBeLessThan(steps.indexOf('release'));
  });

  it('keeps publish before release during recovery without a commit', () => {
    const steps = getPublishSteps({
      shouldCommit: false,
      shouldPublish: true,
      shouldTag: false,
      shouldRelease: true,
      shouldSkip: false,
    });

    expect(steps).toEqual(['publish', 'release']);
  });

  it('pushes a recovered tag before creating a missing release when npm is already published', () => {
    const steps = getPublishSteps({
      shouldCommit: false,
      shouldPublish: false,
      shouldTag: true,
      shouldRelease: true,
      shouldSkip: false,
    });

    expect(steps).toEqual(['tag', 'push', 'release']);
  });
});
