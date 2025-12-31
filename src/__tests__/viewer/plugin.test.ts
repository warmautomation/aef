// src/__tests__/viewer/plugin.test.ts
import { describe, it, expect } from 'bun:test';
import type { ViewerPlugin, PluginAggregation } from '../../viewer/plugin.js';
import { validatePlugin, matchesNamespace } from '../../viewer/plugin.js';

describe('ViewerPlugin interface', () => {
  it('validates a minimal plugin', () => {
    const plugin: ViewerPlugin = {
      namespace: 'test.*',
      name: 'Test Plugin',
    };
    expect(validatePlugin(plugin).valid).toBe(true);
  });

  it('validates plugin with entry renderer', () => {
    const plugin: ViewerPlugin = {
      namespace: 'test.*',
      name: 'Test Plugin',
      renderEntry: (entry, ctx) => ({
        html: '<div>test</div>',
        entryId: entry.id,
        type: entry.type,
      }),
    };
    expect(validatePlugin(plugin).valid).toBe(true);
  });

  it('validates plugin with aggregations', () => {
    const plugin: ViewerPlugin = {
      namespace: 'warmhub.*',
      name: 'WarmHub Plugin',
      aggregations: [
        {
          name: 'beliefTrajectory',
          types: ['warmhub.belief.query', 'warmhub.belief.update'],
          render: (entries, ctx) => '<div>trajectory</div>',
        },
      ],
    };
    expect(validatePlugin(plugin).valid).toBe(true);
    expect(plugin.aggregations?.[0].types).toContain('warmhub.belief.query');
  });

  it('rejects plugin without namespace', () => {
    const plugin = { name: 'Bad Plugin' } as ViewerPlugin;
    expect(validatePlugin(plugin).valid).toBe(false);
  });
});

describe('matchesNamespace', () => {
  it('matches simple wildcard', () => {
    expect(matchesNamespace('warmhub.belief.query', 'warmhub.*')).toBe(true);
    expect(matchesNamespace('other.type', 'warmhub.*')).toBe(false);
  });

  it('matches specific namespace', () => {
    expect(matchesNamespace('warmhub.belief.query', 'warmhub.belief.*')).toBe(true);
    expect(matchesNamespace('warmhub.react.step', 'warmhub.belief.*')).toBe(false);
  });
});
