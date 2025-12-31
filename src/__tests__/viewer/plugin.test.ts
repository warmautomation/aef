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
      namespace: 'vendor.*',
      name: 'Vendor Plugin',
      aggregations: [
        {
          name: 'summary',
          types: ['vendor.category.query', 'vendor.category.update'],
          render: (entries, ctx) => '<div>summary</div>',
        },
      ],
    };
    expect(validatePlugin(plugin).valid).toBe(true);
    expect(plugin.aggregations?.[0].types).toContain('vendor.category.query');
  });

  it('rejects plugin without namespace', () => {
    const plugin = { name: 'Bad Plugin' } as ViewerPlugin;
    expect(validatePlugin(plugin).valid).toBe(false);
  });
});

describe('matchesNamespace', () => {
  it('matches simple wildcard', () => {
    expect(matchesNamespace('vendor.category.query', 'vendor.*')).toBe(true);
    expect(matchesNamespace('other.type', 'vendor.*')).toBe(false);
  });

  it('matches specific namespace', () => {
    expect(matchesNamespace('vendor.category.query', 'vendor.category.*')).toBe(true);
    expect(matchesNamespace('vendor.other.step', 'vendor.category.*')).toBe(false);
  });
});
