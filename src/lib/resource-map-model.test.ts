import { describe, expect, it } from 'vitest';
import { deleteResource, setResource } from './resource-map-model';

describe('resource map model', () => {
  it('sets a resource without mutating the source map', () => {
    const source = new Map([['upload-1', 'old']]);
    const next = setResource(source, 'upload-1', 'new');

    expect(source).toEqual(new Map([['upload-1', 'old']]));
    expect(next).toEqual(new Map([['upload-1', 'new']]));
  });

  it('deletes only the requested resource without mutating the source map', () => {
    const source = new Map([
      ['upload-1', 'one'],
      ['upload-2', 'two']
    ]);
    const next = deleteResource(source, 'upload-1');

    expect(source).toEqual(
      new Map([
        ['upload-1', 'one'],
        ['upload-2', 'two']
      ])
    );
    expect(next).toEqual(new Map([['upload-2', 'two']]));
  });
});
