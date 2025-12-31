/**
 * Claude Code Adapter
 *
 * Transforms Claude Code session logs into ALF format.
 */

import type { LogAdapter } from './adapter.js';
import type { AnyALFEntry } from '../types.js';

/**
 * Adapter for Claude Code session logs.
 * Transforms event-centric format to ALF entries.
 */
export const claudeCodeAdapter: LogAdapter<AsyncIterable<string>> = {
  id: 'claude-code',
  name: 'Claude Code',
  patterns: ['~/.claude/projects/**/*.jsonl'],

  async *parse(_lines: AsyncIterable<string>): AsyncIterable<AnyALFEntry> {
    // TODO: Implement
    yield* [];
  },
};

export default claudeCodeAdapter;
