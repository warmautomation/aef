// src/viewer/registry.ts
import type { ViewerPlugin, PluginAggregation } from './plugin.js';
import { validatePlugin, matchesNamespace } from './plugin.js';

export class PluginRegistry {
  private plugins: ViewerPlugin[] = [];

  register(plugin: ViewerPlugin): void {
    const validation = validatePlugin(plugin);
    if (!validation.valid) {
      throw new Error(`Invalid plugin: ${validation.errors.join(', ')}`);
    }
    this.plugins.push(plugin);
    // Sort by specificity (more dots = more specific)
    this.plugins.sort((a, b) => {
      const dotsA = (a.namespace.match(/\./g) || []).length;
      const dotsB = (b.namespace.match(/\./g) || []).length;
      return dotsB - dotsA;
    });
  }

  findPlugin(entryType: string): ViewerPlugin | null {
    for (const plugin of this.plugins) {
      if (matchesNamespace(entryType, plugin.namespace)) {
        return plugin;
      }
    }
    return null;
  }

  getPlugins(): ViewerPlugin[] {
    return [...this.plugins];
  }

  getAggregations(): Array<PluginAggregation & { pluginName: string }> {
    const result: Array<PluginAggregation & { pluginName: string }> = [];
    for (const plugin of this.plugins) {
      if (plugin.aggregations) {
        for (const agg of plugin.aggregations) {
          result.push({ ...agg, pluginName: plugin.name });
        }
      }
    }
    return result;
  }

  getStyles(): string {
    return this.plugins.filter(p => p.styles).map(p => `/* ${p.name} */\n${p.styles}`).join('\n\n');
  }

  getScripts(): string {
    return this.plugins.filter(p => p.scripts).map(p => `// ${p.name}\n${p.scripts}`).join('\n\n');
  }

  async initialize(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.initialize) await plugin.initialize();
    }
  }
}

export const defaultRegistry = new PluginRegistry();
