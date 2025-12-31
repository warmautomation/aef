/**
 * ReActPOC Adapter
 *
 * Transforms ReActPOC belief-conditioned agent traces into ALF format.
 */

import type { LogAdapter } from './adapter.js';
import type { AnyALFEntry } from '../types.js';

/**
 * Adapter for ReActPOC belief-conditioned agent traces.
 * Transforms episode-centric format to event-centric ALF entries.
 */
export const reactpocAdapter: LogAdapter<AsyncIterable<string>> = {
  id: 'reactpoc',
  name: 'ReActPOC Belief Agent',
  patterns: ['logs/*_traces_*.jsonl', 'logs/belief-test_*.jsonl'],

  async *parse(_lines: AsyncIterable<string>): AsyncIterable<AnyALFEntry> {
    // TODO: Implement
    yield* [];
  },
};

export default reactpocAdapter;
