export type MockPermission = 'owner' | 'editor' | 'viewer';

export function mockPermissionFromQuery(value: string | null): MockPermission {
  if (value === 'viewer') return 'viewer';
  if (value === 'editor') return 'editor';
  return 'owner';
}
