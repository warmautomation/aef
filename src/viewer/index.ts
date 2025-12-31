// src/viewer/index.ts
export { generateHtml } from './html.js';
export type { ViewerOptions, RenderContext, RenderedEntry, EntryRenderer } from './types.js';
export { getCoreStyles, getThemeVariables } from './styles.js';
export * from './renderers/index.js';
export * from './utils.js';

// Plugin system
export type { ViewerPlugin, PluginAggregation, PluginValidationResult } from './plugin.js';
export { validatePlugin, matchesNamespace } from './plugin.js';
export { PluginRegistry, defaultRegistry } from './registry.js';

// Components (sparklines, waterfall, etc.)
export * from './components/index.js';
