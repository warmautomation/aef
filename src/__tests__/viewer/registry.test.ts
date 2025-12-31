// src/__tests__/viewer/registry.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { PluginRegistry } from '../../viewer/registry.js';
import type { ViewerPlugin } from '../../viewer/plugin.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('registers a plugin', () => {
    const plugin: ViewerPlugin = { namespace: 'test.*', name: 'Test Plugin' };
    registry.register(plugin);
    expect(registry.getPlugins()).toHaveLength(1);
  });

  it('finds plugin for entry type', () => {
    const plugin: ViewerPlugin = { namespace: 'vendor.*', name: 'Vendor Plugin' };
    registry.register(plugin);
    const found = registry.findPlugin('vendor.category.query');
    expect(found?.name).toBe('Vendor Plugin');
  });

  it('returns null for unmatched entry type', () => {
    const plugin: ViewerPlugin = { namespace: 'vendor.*', name: 'Vendor Plugin' };
    registry.register(plugin);
    const found = registry.findPlugin('other.custom.type');
    expect(found).toBeNull();
  });

  it('prioritizes more specific namespaces', () => {
    registry.register({ namespace: 'vendor.*', name: 'General Vendor' });
    registry.register({ namespace: 'vendor.category.*', name: 'Specific Category' });
    const found = registry.findPlugin('vendor.category.query');
    expect(found?.name).toBe('Specific Category');
  });

  it('rejects invalid plugins', () => {
    const invalid = { name: 'No Namespace' } as ViewerPlugin;
    expect(() => registry.register(invalid)).toThrow();
  });

  it('collects all aggregations', () => {
    const plugin: ViewerPlugin = {
      namespace: 'vendor.*',
      name: 'Vendor',
      aggregations: [{ name: 'summary', types: ['vendor.category.query'], render: () => '' }],
    };
    registry.register(plugin);
    const aggs = registry.getAggregations();
    expect(aggs).toHaveLength(1);
    expect(aggs[0].name).toBe('summary');
  });
});
