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
    const plugin: ViewerPlugin = { namespace: 'warmhub.*', name: 'WarmHub Plugin' };
    registry.register(plugin);
    const found = registry.findPlugin('warmhub.belief.query');
    expect(found?.name).toBe('WarmHub Plugin');
  });

  it('returns null for unmatched entry type', () => {
    const plugin: ViewerPlugin = { namespace: 'warmhub.*', name: 'WarmHub Plugin' };
    registry.register(plugin);
    const found = registry.findPlugin('other.custom.type');
    expect(found).toBeNull();
  });

  it('prioritizes more specific namespaces', () => {
    registry.register({ namespace: 'warmhub.*', name: 'General WarmHub' });
    registry.register({ namespace: 'warmhub.belief.*', name: 'Specific Belief' });
    const found = registry.findPlugin('warmhub.belief.query');
    expect(found?.name).toBe('Specific Belief');
  });

  it('rejects invalid plugins', () => {
    const invalid = { name: 'No Namespace' } as ViewerPlugin;
    expect(() => registry.register(invalid)).toThrow();
  });

  it('collects all aggregations', () => {
    const plugin: ViewerPlugin = {
      namespace: 'warmhub.*',
      name: 'WarmHub',
      aggregations: [{ name: 'trajectory', types: ['warmhub.belief.query'], render: () => '' }],
    };
    registry.register(plugin);
    const aggs = registry.getAggregations();
    expect(aggs).toHaveLength(1);
    expect(aggs[0].name).toBe('trajectory');
  });
});
