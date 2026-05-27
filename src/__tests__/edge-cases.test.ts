import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentData, MetadataStore } from '../types.js';

function makeStore(components: Partial<ComponentData>[]): MetadataStore {
  return {
    version: '5.99.0',
    majorVersion: 'v5',
    components: components.map((c) => ({
      name: 'TestComp',
      nameZh: '测试',
      category: 'Other',
      description: 'Test component',
      descriptionZh: '测试',
      props: [],
      demos: [],
      ...c,
    })) as ComponentData[],
  };
}

// Hoisted mock state — referenced by vi.mock factory below
const mocks = vi.hoisted(() => ({
  store: null as MetadataStore | null,
}));

vi.mock('../data/loader.js', async () => {
  const actual = await vi.importActual<typeof import('../data/loader.js')>('../data/loader.js');
  return {
    ...actual,
    loadMetadataForVersion: (version: string) => mocks.store ?? actual.loadMetadataForVersion(version),
    resolveComponent: (component: string, version: string) => {
      const store = mocks.store ?? actual.loadMetadataForVersion(version);
      const comp = store.components.find((c) => c.name.toLowerCase() === component.toLowerCase());
      if (!comp) {
        return actual.resolveComponent(component, version);
      }
      return { store, comp };
    },
  };
});

// Import helper AFTER vi.mock so the mocked module is used in the CLI flow.
const { run, runStderr } = await import('./helper.js');

describe('edge cases via mocked loader', () => {
  beforeEach(() => {
    mocks.store = null;
  });

  it('demo command shows "No demos available" when component has no demos', async () => {
    mocks.store = makeStore([{ name: 'EmptyDemo', demos: [] }]);
    const out = await run('demo', 'EmptyDemo');
    expect(out).toContain('No demos available');
  });

  it('doc command returns DOC_NOT_AVAILABLE when component has no doc', async () => {
    mocks.store = makeStore([{ name: 'NoDocComp', doc: undefined as never, docZh: undefined as never }]);
    const stderr = await runStderr('doc', 'NoDocComp', '--format', 'json');
    const err = JSON.parse(stderr);
    expect(err.code).toBe('DOC_NOT_AVAILABLE');
  });
});
