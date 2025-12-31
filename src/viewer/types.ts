import type { AEFEntry, CoreEntry } from '../types.js';

/**
 * Options for HTML generation
 */
export interface ViewerOptions {
  /** Color theme */
  theme?: 'light' | 'dark';
  /** Collapse tool results by default */
  collapsedTools?: boolean;
  /** Maximum content length before truncation */
  maxContentLength?: number;
  /** Include entry timestamps */
  showTimestamps?: boolean;
  /** Include sequence numbers */
  showSequence?: boolean;
}

/**
 * Context passed to renderers
 */
export interface RenderContext {
  sessionId: string;
  entryIndex: number;
  totalEntries: number;
  options: ViewerOptions;
  /** All entries in session (for cross-referencing) */
  entries?: AEFEntry[];
}

/**
 * Result of rendering a single entry
 */
export interface RenderedEntry {
  html: string;
  entryId: string;
  type: string;
  /** CSS classes to add to wrapper */
  cssClasses?: string[];
}

/**
 * Entry renderer function signature
 */
export type EntryRenderer<T extends AEFEntry = AEFEntry> = (
  entry: T,
  ctx: RenderContext
) => RenderedEntry | null;
