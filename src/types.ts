/**
 * ALF Type Definitions
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Base ALF entry - all entries must have these fields
 */
export interface ALFEntry {
  /** Schema version */
  v: 1;
  /** Entry ID (UUIDv7 or ULID recommended) */
  id: string;
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Entry type (namespaced for extensions) */
  type: string;
  /** Session ID - groups related entries */
  sid: string;
  /** Parent ID - for threading/causality */
  pid?: string;
  /** Sequence number within session */
  seq?: number;
}

/**
 * Session start entry
 */
export interface SessionStart extends ALFEntry {
  type: 'session.start';
  agent: string;
  version?: string;
  workspace?: string;
  model?: string;
  meta?: Record<string, unknown>;
}

/**
 * Session end entry
 */
export interface SessionEnd extends ALFEntry {
  type: 'session.end';
  status: 'complete' | 'error' | 'timeout' | 'user_abort';
  summary?: {
    messages?: number;
    tool_calls?: number;
    duration_ms?: number;
    tokens?: { input: number; output: number };
  };
}

/**
 * Message entry (user, assistant, or system)
 */
export interface Message extends ALFEntry {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  tokens?: { input?: number; output?: number; cached?: number };
}

/**
 * Content block types (matches Anthropic API)
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Tool call entry
 */
export interface ToolCall extends ALFEntry {
  type: 'tool.call';
  tool: string;
  args: Record<string, unknown>;
  call_id?: string;
}

/**
 * Tool result entry
 */
export interface ToolResult extends ALFEntry {
  type: 'tool.result';
  tool: string;
  call_id?: string;
  result: unknown;
  success: boolean;
  duration_ms?: number;
  error?: { code?: string; message: string };
}

/**
 * Error entry
 */
export interface ErrorEntry extends ALFEntry {
  type: 'error';
  code?: string;
  message: string;
  stack?: string;
  recoverable?: boolean;
}

/**
 * Union of all core entry types
 */
export type CoreEntry =
  | SessionStart
  | SessionEnd
  | Message
  | ToolCall
  | ToolResult
  | ErrorEntry;

// =============================================================================
// Extension: warmhub.belief.*
// =============================================================================

/**
 * Belief state query entry
 */
export interface BeliefQuery extends ALFEntry {
  type: 'warmhub.belief.query';
  query: string;
  snapshot: {
    hypotheses: Array<{
      id: string;
      desc: string;
      b: number;
      d: number;
      u: number;
    }>;
    assertions: number;
    finish_ready: boolean;
    leading?: string;
  };
}

/**
 * Belief state update entry
 */
export interface BeliefUpdate extends ALFEntry {
  type: 'warmhub.belief.update';
  assertion: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    source: string;
    content?: string;
    consistent_with?: string[];
    inconsistent_with?: string[];
  };
  deltas?: Array<{
    hyp: string;
    db: number;
    dd: number;
    du: number;
  }>;
  snapshot_after?: BeliefQuery['snapshot'];
}

// =============================================================================
// Extension: warmhub.react.*
// =============================================================================

/**
 * ReAct agent step entry
 */
export interface ReactStep extends ALFEntry {
  type: 'warmhub.react.step';
  step: number;
  thought?: string;
  action: string;
  action_arg?: string;
  observation?: string;
  latency_ms?: number;
  tokens?: { input: number; output: number };
}

/**
 * ReAct episode summary entry
 */
export interface ReactEpisode extends ALFEntry {
  type: 'warmhub.react.episode';
  question_id: string;
  question: string;
  gold_answer: string;
  predicted_answer?: string;
  status: 'success' | 'max_steps' | 'error' | 'parse_failure' | 'timeout';
  metrics: {
    em: number;
    f1: number;
    tool_calls: number;
    total_latency_ms: number;
    total_tokens: number;
  };
  belief_metrics?: {
    hypothesis_reversals: number;
    final_confidence: number;
    uncertainty_reduction: number;
    finish_gate_respected: boolean;
  };
}

/**
 * Union of all extension entry types
 */
export type ExtensionEntry = BeliefQuery | BeliefUpdate | ReactStep | ReactEpisode;

/**
 * Any ALF entry (core or extension)
 */
export type AnyALFEntry = CoreEntry | ExtensionEntry;
