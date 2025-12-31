// src/viewer/index.ts
export { generateHtml } from './html.js';
export type { ViewerOptions, RenderContext, RenderedEntry, EntryRenderer } from './types.js';
export { getCoreStyles, getThemeVariables } from './styles.js';
export * from './renderers/index.js';
export * from './utils.js';
