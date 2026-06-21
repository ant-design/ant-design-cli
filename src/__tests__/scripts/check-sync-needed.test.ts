import { describe, expect, it } from 'vitest';
import { getLatestStableVersion, resolveSyncStatus } from '../../../scripts/check-sync-needed.js';

describe('check-sync-needed', () => {
  it('picks the latest stable version from npm view version output', () => {
    const output = [
      "antd@6.0.0 '6.0.0'",
      "antd@6.4.3 '6.4.3'",
      "antd@6.4.4 '6.4.4'",
    ].join('\n');

    expect(getLatestStableVersion(output)).toBe('6.4.4');
  });

  it('does not request sync when npm output includes all versions and local data is current', () => {
    const status = resolveSyncStatus({
      majors: [6],
      getLatestNpmVersion: () => '6.4.4',
      getLocalVersion: () => '6.4.4',
      isCliVersionPublished: () => true,
    });

    expect(status.needsSync).toBe(false);
    expect(status.needsPublish).toBe(false);
  });
});
