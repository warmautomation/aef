/**
 * Claude Code Adapter
 *
 * Transforms Claude Code session logs into AEF format.
 *
 * Claude Code Log Format:
 * - Location: ~/.claude/projects/<project>/<session>.jsonl
 * - Entry types: queue-operation (skip), user, assistant
 * - Messages contain content blocks: text, tool_use, tool_result
 */

import type { LogAdapter } from './adapter.js';
import { generateId } from './adapter.js';
import type {
  AnyAEFEntry,
  SessionStart,
  SessionEnd,
  Message,
  ToolCall,
  ToolResult,
  ContentBlock,
} from '../types.js';

// =============================================================================
// Claude Code Source Types
// =============================================================================

/** Content block in Claude Code messages */
interface CCContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

/** Claude Code message structure */
interface CCMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | CCContentBlock[];
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/** Claude Code log entry */
interface CCEntry {
  type: 'queue-operation' | 'user' | 'assistant' | 'file-history-snapshot' | 'summary';
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  message?: CCMessage;
  version?: string;
  cwd?: string;
  gitBranch?: string;
  userType?: string;
  isSidechain?: boolean;
}

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Adapter for Claude Code session logs.
 * Transforms Claude Code's event-centric format to AEF entries.
 */
export const claudeCodeAdapter: LogAdapter<AsyncIterable<string>> = {
  id: 'claude-code',
  name: 'Claude Code',
  patterns: ['~/.claude/projects/**/*.jsonl'],

  async *parse(lines: AsyncIterable<string>): AsyncIterable<AnyAEFEntry> {
    const entries: CCEntry[] = [];

    // Collect all entries first (needed for session boundaries and summary)
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const entry = JSON.parse(trimmed) as CCEntry;
        entries.push(entry);
      } catch {
        // Skip unparseable lines
        continue;
      }
    }

    // Filter to user/assistant entries only
    const messageEntries = entries.filter(
      (e) => e.type === 'user' || e.type === 'assistant'
    );

    if (messageEntries.length === 0) {
      return;
    }

    // Get session metadata from first entry
    const firstEntry = messageEntries[0];
    const sessionId = firstEntry.sessionId ?? generateId();
    const firstTimestamp = firstEntry.timestamp
      ? new Date(firstEntry.timestamp).getTime()
      : Date.now();

    // Track statistics for session.end summary
    let messageCount = 0;
    let toolCallCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let seq = 0;

    // Emit session.start
    const sessionStart: SessionStart = {
      v: 1,
      id: generateId(),
      ts: firstTimestamp,
      type: 'session.start',
      sid: sessionId,
      agent: 'claude-code',
      version: firstEntry.version,
      workspace: firstEntry.cwd,
      model: messageEntries.find((e) => e.message?.model)?.message?.model,
      meta: firstEntry.gitBranch ? { gitBranch: firstEntry.gitBranch } : undefined,
    };
    yield sessionStart;

    // Process each message entry
    let lastEntryId = sessionStart.id;
    let lastTimestamp = firstTimestamp;

    for (const entry of messageEntries) {
      if (!entry.message || !entry.uuid) continue;

      const timestamp = entry.timestamp
        ? new Date(entry.timestamp).getTime()
        : lastTimestamp + 1;
      lastTimestamp = timestamp;

      const role = entry.type === 'user' ? 'user' : 'assistant';
      const content = entry.message.content;

      // Create message entry
      const messageId = entry.uuid;
      const parentId = entry.parentUuid ?? lastEntryId;

      // Convert content to AEF format
      let aefContent: string | ContentBlock[];
      if (typeof content === 'string') {
        aefContent = content;
      } else {
        aefContent = content.map((block): ContentBlock => {
          if (block.type === 'text') {
            return { type: 'text', text: block.text ?? '' };
          } else if (block.type === 'tool_use') {
            return {
              type: 'tool_use',
              id: block.id ?? generateId(),
              name: block.name ?? 'unknown',
              input: block.input ?? {},
            };
          } else {
            return {
              type: 'tool_result',
              tool_use_id: block.tool_use_id ?? '',
              content: block.content ?? '',
              is_error: block.is_error ?? undefined,
            };
          }
        });
      }

      // Emit message entry
      const message: Message = {
        v: 1,
        id: messageId,
        ts: timestamp,
        type: 'message',
        sid: sessionId,
        pid: parentId,
        seq: seq++,
        role,
        content: aefContent,
        model: entry.message.model,
        tokens: entry.message.usage
          ? {
              input: entry.message.usage.input_tokens,
              output: entry.message.usage.output_tokens,
              cached:
                (entry.message.usage.cache_read_input_tokens ?? 0) +
                (entry.message.usage.cache_creation_input_tokens ?? 0),
            }
          : undefined,
      };
      yield message;
      messageCount++;

      // Track token usage
      if (entry.message.usage) {
        totalInputTokens += entry.message.usage.input_tokens ?? 0;
        totalOutputTokens += entry.message.usage.output_tokens ?? 0;
      }

      // Extract and emit tool.call and tool.result entries from content blocks
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            const toolCallId = block.id ?? generateId();
            const toolCall: ToolCall = {
              v: 1,
              id: generateId(),
              ts: timestamp,
              type: 'tool.call',
              sid: sessionId,
              pid: messageId,
              tool: block.name ?? 'unknown',
              args: block.input ?? {},
              call_id: toolCallId,
            };
            yield toolCall;
            toolCallCount++;
          } else if (block.type === 'tool_result') {
            const toolResult: ToolResult = {
              v: 1,
              id: generateId(),
              ts: timestamp,
              type: 'tool.result',
              sid: sessionId,
              pid: messageId,
              tool: 'unknown', // Claude Code doesn't track tool name in result
              call_id: block.tool_use_id,
              result: block.content,
              success: !block.is_error,
              error: block.is_error
                ? { message: block.content ?? 'Tool execution failed' }
                : undefined,
            };
            yield toolResult;
          }
        }
      }

      lastEntryId = messageId;
    }

    // Emit session.end
    const lastEntry = messageEntries[messageEntries.length - 1];
    const lastTs = lastEntry.timestamp
      ? new Date(lastEntry.timestamp).getTime()
      : lastTimestamp;

    const sessionEnd: SessionEnd = {
      v: 1,
      id: generateId(),
      ts: lastTs,
      type: 'session.end',
      sid: sessionId,
      status: 'complete',
      summary: {
        messages: messageCount,
        tool_calls: toolCallCount,
        duration_ms: lastTs - firstTimestamp,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
      },
    };
    yield sessionEnd;
  },
};

export default claudeCodeAdapter;
