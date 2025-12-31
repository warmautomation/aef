/**
 * Adapter Interface
 *
 * Base interface for log format adapters.
 */

import type { AnyALFEntry } from '../types.js';

/**
 * Interface for log format adapters.
 * Adapters transform source format logs into ALF entries.
 */
export interface LogAdapter<TSource = unknown> {
  /** Adapter identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Supported source file patterns (globs) */
  readonly patterns: string[];

  /** Parse source data and yield ALF entries */
  parse(source: TSource): AsyncIterable<AnyALFEntry>;
}

/**
 * Generate a unique ID for ALF entries
 */
export function generateId(): string {
  const ts = Date.now().toString(16).padStart(12, '0');
  const rand = Math.random().toString(16).slice(2, 10);
  return `${ts}-${rand}`;
}
