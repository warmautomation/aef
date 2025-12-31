/**
 * ALF Core Type Definitions
 *
 * Extensions are NOT defined here - they use the base ALFEntry interface
 * and are validated by namespace pattern matching. See docs/extensions.md
 * for extension schema documentation.
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
 * Content block types
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
// Type Guards
// =============================================================================

const CORE_TYPES = [
  'session.start',
  'session.end',
  'message',
  'tool.call',
  'tool.result',
  'error',
] as const;

/**
 * Type guard for core entry types
 */
export function isCoreEntry(entry: ALFEntry): entry is CoreEntry {
  return CORE_TYPES.includes(entry.type as (typeof CORE_TYPES)[number]);
}

/**
 * Type guard for extension entries (namespaced types like vendor.category.type)
 */
export function isExtensionEntry(entry: ALFEntry): boolean {
  // Extensions have at least 2 dots (vendor.category.type) and are not core types
  const dotCount = (entry.type.match(/\./g) || []).length;
  return dotCount >= 2 && !isCoreEntry(entry);
}

/**
 * Check if an entry has valid base fields (for extension validation)
 */
export function hasValidBaseFields(entry: unknown): entry is ALFEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    e.v === 1 &&
    typeof e.id === 'string' &&
    typeof e.ts === 'number' &&
    typeof e.type === 'string' &&
    typeof e.sid === 'string'
  );
}
