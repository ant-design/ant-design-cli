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
