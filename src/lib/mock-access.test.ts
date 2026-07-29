import { describe, expect, it } from 'vitest';
import { mockPermissionFromQuery } from './mock-access';

describe('mock access', () => {
  it('supports explicit viewer and editor scenarios', () => {
    expect(mockPermissionFromQuery('viewer')).toBe('viewer');
    expect(mockPermissionFromQuery('editor')).toBe('editor');
  });

  it('defaults unknown or missing access to the owner scenario', () => {
    expect(mockPermissionFromQuery(null)).toBe('owner');
    expect(mockPermissionFromQuery('admin')).toBe('owner');
  });
});
