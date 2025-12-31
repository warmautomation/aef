// src/viewer/plugin.ts
import type { ALFEntry } from '../types.js';
import type { RenderContext, RenderedEntry } from './types.js';

export interface PluginAggregation {
  name: string;
  types: string[];
  render: (entries: ALFEntry[], ctx: RenderContext) => string;
  position?: 'header' | 'footer' | 'inline';
}

export interface ViewerPlugin {
  readonly namespace: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  renderEntry?: (entry: ALFEntry, ctx: RenderContext) => RenderedEntry | null;
  aggregations?: PluginAggregation[];
  styles?: string;
  scripts?: string;
  initialize?: () => void | Promise<void>;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePlugin(plugin: ViewerPlugin): PluginValidationResult {
  const errors: string[] = [];
  if (!plugin.namespace) {
    errors.push('Plugin must have a namespace');
  } else if (!plugin.namespace.includes('*') && !plugin.namespace.includes('.')) {
    errors.push('Namespace must be a pattern (e.g., "vendor.*" or "vendor.category.*")');
  }
  if (!plugin.name) {
    errors.push('Plugin must have a name');
  }
  if (plugin.aggregations) {
    for (const agg of plugin.aggregations) {
      if (!agg.name) errors.push('Aggregation must have a name');
      if (!agg.types || agg.types.length === 0) {
        errors.push(`Aggregation "${agg.name}" must specify types`);
      }
      if (!agg.render) {
        errors.push(`Aggregation "${agg.name}" must have a render function`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function matchesNamespace(entryType: string, namespace: string): boolean {
  const pattern = namespace.replace(/\./g, '\\.').replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(entryType);
}
