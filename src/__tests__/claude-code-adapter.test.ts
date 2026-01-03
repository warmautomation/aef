/**
 * Tests for Claude Code Adapter
 */

import { describe, it, expect } from 'bun:test';
import { claudeCodeAdapter } from '../adapters/claude-code.js';
import { validateAEFEntry } from '../validator.js';
import type {
  AnyAEFEntry,
  SessionStart,
  SessionEnd,
  Message,
  ToolCall,
  ToolResult,
} from '../types.js';

// Helper to create async iterable from lines
async function* linesFromArray(lines: string[]): AsyncIterable<string> {
  for (const line of lines) {
    yield line;
  }
}

// Helper to collect entries from adapter
async function collectEntries(lines: string[]): Promise<AnyAEFEntry[]> {
  const entries: AnyAEFEntry[] = [];
  for await (const entry of claudeCodeAdapter.parse(linesFromArray(lines))) {
    entries.push(entry);
  }
  return entries;
}

describe('claudeCodeAdapter', () => {
  it('has correct metadata', () => {
    expect(claudeCodeAdapter.id).toBe('claude-code');
    expect(claudeCodeAdapter.name).toBe('Claude Code');
    expect(claudeCodeAdapter.patterns).toContain('~/.claude/projects/**/*.jsonl');
  });

  describe('empty input', () => {
    it('yields no entries for empty input', async () => {
      const entries = await collectEntries([]);
      expect(entries).toHaveLength(0);
    });

    it('yields no entries for only queue-operation entries', async () => {
      const lines = [
        JSON.stringify({ type: 'queue-operation', operation: 'enqueue', sessionId: 'test' }),
        JSON.stringify({ type: 'queue-operation', operation: 'dequeue', sessionId: 'test' }),
      ];
      const entries = await collectEntries(lines);
      expect(entries).toHaveLength(0);
    });
  });

  describe('simple conversation', () => {
    const simpleConversation = [
      JSON.stringify({
        type: 'user',
        uuid: 'user-1',
        parentUuid: null,
        sessionId: 'session-123',
        timestamp: '2025-01-01T12:00:00.000Z',
        version: '1.0.0',
        cwd: '/home/user/project',
        gitBranch: 'main',
        message: {
          role: 'user',
          content: 'Hello, world!',
        },
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-1',
        parentUuid: 'user-1',
        sessionId: 'session-123',
        timestamp: '2025-01-01T12:00:01.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello! How can I help you?' }],
          model: 'claude-3-opus',
          usage: { input_tokens: 10, output_tokens: 20 },
        },
      }),
    ];

    it('produces session.start, messages, and session.end', async () => {
      const entries = await collectEntries(simpleConversation);

      // Should have: session.start, user message, assistant message, session.end
      expect(entries.length).toBeGreaterThanOrEqual(4);
      expect(entries[0].type).toBe('session.start');
      expect(entries[entries.length - 1].type).toBe('session.end');
    });

    it('produces valid AEF entries', async () => {
      const entries = await collectEntries(simpleConversation);

      for (const entry of entries) {
        const result = validateAEFEntry(entry);
        expect(result.valid).toBe(true);
      }
    });

    it('extracts session metadata correctly', async () => {
      const entries = await collectEntries(simpleConversation);
      const sessionStart = entries[0] as SessionStart;

      expect(sessionStart.type).toBe('session.start');
      expect(sessionStart.sid).toBe('session-123');
      expect(sessionStart.agent).toBe('claude-code');
      expect(sessionStart.version).toBe('1.0.0');
      expect(sessionStart.workspace).toBe('/home/user/project');
      expect(sessionStart.model).toBe('claude-3-opus');
      expect(sessionStart.meta).toEqual({ gitBranch: 'main' });
    });

    it('preserves parent-child relationships', async () => {
      const entries = await collectEntries(simpleConversation);

      const userMessage = entries.find(
        (e) => e.type === 'message' && (e as Message).role === 'user'
      );
      const assistantMessage = entries.find(
        (e) => e.type === 'message' && (e as Message).role === 'assistant'
      );

      expect(userMessage).toBeDefined();
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage!.pid).toBe('user-1');
    });

    it('calculates session summary correctly', async () => {
      const entries = await collectEntries(simpleConversation);
      const sessionEnd = entries[entries.length - 1] as SessionEnd;

      expect(sessionEnd.type).toBe('session.end');
      expect(sessionEnd.status).toBe('complete');
      expect(sessionEnd.summary?.messages).toBe(2);
      expect(sessionEnd.summary?.tool_calls).toBe(0);
      expect(sessionEnd.summary?.tokens).toEqual({ input: 10, output: 20 });
    });
  });

  describe('conversation with tools', () => {
    const toolConversation = [
      JSON.stringify({
        type: 'user',
        uuid: 'user-1',
        parentUuid: null,
        sessionId: 'session-456',
        timestamp: '2025-01-01T12:00:00.000Z',
        message: {
          role: 'user',
          content: 'List files in current directory',
        },
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-1',
        parentUuid: 'user-1',
        sessionId: 'session-456',
        timestamp: '2025-01-01T12:00:01.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check the files for you.' },
            {
              type: 'tool_use',
              id: 'tool-call-1',
              name: 'Bash',
              input: { command: 'ls -la' },
            },
          ],
          model: 'claude-3-opus',
        },
      }),
      JSON.stringify({
        type: 'user',
        uuid: 'user-2',
        parentUuid: 'assistant-1',
        sessionId: 'session-456',
        timestamp: '2025-01-01T12:00:02.000Z',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-call-1',
              content: 'total 16\n-rw-r--r-- 1 user user 1234 Jan 1 12:00 README.md',
            },
          ],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-2',
        parentUuid: 'user-2',
        sessionId: 'session-456',
        timestamp: '2025-01-01T12:00:03.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'The directory contains README.md.' }],
          model: 'claude-3-opus',
        },
      }),
    ];

    it('extracts tool.call entries from assistant messages', async () => {
      const entries = await collectEntries(toolConversation);
      const toolCalls = entries.filter((e) => e.type === 'tool.call') as ToolCall[];

      expect(toolCalls.length).toBe(1);
      expect(toolCalls[0].tool).toBe('Bash');
      expect(toolCalls[0].call_id).toBe('tool-call-1');
      expect(toolCalls[0].args).toEqual({ command: 'ls -la' });
    });

    it('extracts tool.result entries from user messages', async () => {
      const entries = await collectEntries(toolConversation);
      const toolResults = entries.filter((e) => e.type === 'tool.result') as ToolResult[];

      expect(toolResults.length).toBe(1);
      expect(toolResults[0].call_id).toBe('tool-call-1');
      expect(toolResults[0].success).toBe(true);
      expect(toolResults[0].result).toContain('README.md');
    });

    it('produces valid AEF entries for tool calls', async () => {
      const entries = await collectEntries(toolConversation);

      for (const entry of entries) {
        const result = validateAEFEntry(entry);
        expect(result.valid).toBe(true);
      }
    });

    it('counts tool calls in session summary', async () => {
      const entries = await collectEntries(toolConversation);
      const sessionEnd = entries[entries.length - 1] as SessionEnd;

      expect(sessionEnd.summary?.tool_calls).toBe(1);
    });

    it('tool.result.pid points to corresponding tool.call.id', async () => {
      const entries = await collectEntries(toolConversation);
      const toolCall = entries.find((e) => e.type === 'tool.call') as ToolCall;
      const toolResult = entries.find((e) => e.type === 'tool.result') as ToolResult;

      expect(toolCall).toBeDefined();
      expect(toolResult).toBeDefined();
      // The tool.result should have pid pointing to tool.call's id, not the message
      expect(toolResult.pid).toBe(toolCall.id);
    });

    it('assistant message after tool.result has pid pointing to tool.result', async () => {
      const entries = await collectEntries(toolConversation);
      const toolResult = entries.find((e) => e.type === 'tool.result') as ToolResult;
      // Find the final assistant message (after the tool result)
      const messages = entries.filter((e) => e.type === 'message') as Message[];
      const finalAssistantMessage = messages.find(
        (m) => m.role === 'assistant' && m.content === 'The directory contains README.md.' ||
               (Array.isArray(m.content) && m.content.some(
                 (c) => c.type === 'text' && (c as { text: string }).text === 'The directory contains README.md.'
               ))
      );

      expect(toolResult).toBeDefined();
      expect(finalAssistantMessage).toBeDefined();
      // The assistant message following the tool result should have pid pointing to tool.result
      expect(finalAssistantMessage!.pid).toBe(toolResult.id);
    });
  });

  describe('error handling', () => {
    it('handles tool results with is_error flag', async () => {
      const lines = [
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          parentUuid: null,
          sessionId: 'session-789',
          timestamp: '2025-01-01T12:00:00.000Z',
          message: { role: 'user', content: 'run something' },
        }),
        JSON.stringify({
          type: 'user',
          uuid: 'user-2',
          parentUuid: 'assistant-1',
          sessionId: 'session-789',
          timestamp: '2025-01-01T12:00:01.000Z',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'Permission denied',
                is_error: true,
              },
            ],
          },
        }),
      ];

      const entries = await collectEntries(lines);
      const toolResult = entries.find((e) => e.type === 'tool.result') as ToolResult;

      expect(toolResult).toBeDefined();
      expect(toolResult.success).toBe(false);
      expect(toolResult.error).toBeDefined();
      expect(toolResult.error?.message).toBe('Permission denied');
    });

    it('skips unparseable lines', async () => {
      const lines = [
        'not valid json',
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          message: { role: 'user', content: 'Hello' },
        }),
        '{ incomplete json',
      ];

      const entries = await collectEntries(lines);
      // Should still produce session.start, message, session.end
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('skips empty lines', async () => {
      const lines = [
        '',
        '   ',
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          message: { role: 'user', content: 'Hello' },
        }),
        '',
      ];

      const entries = await collectEntries(lines);
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('sequence numbers', () => {
    it('assigns monotonically increasing seq numbers', async () => {
      const lines = [
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          message: { role: 'user', content: 'First' },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:01.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Response 1' }] },
        }),
        JSON.stringify({
          type: 'user',
          uuid: 'user-2',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:02.000Z',
          message: { role: 'user', content: 'Second' },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:03.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Response 2' }] },
        }),
      ];

      const entries = await collectEntries(lines);
      const messages = entries.filter((e) => e.type === 'message') as Message[];

      expect(messages.length).toBe(4);
      expect(messages[0].seq).toBe(0);
      expect(messages[1].seq).toBe(1);
      expect(messages[2].seq).toBe(2);
      expect(messages[3].seq).toBe(3);
    });
  });

  describe('token tracking', () => {
    it('aggregates tokens across messages', async () => {
      const lines = [
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'First' }],
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:01.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Second' }],
            usage: { input_tokens: 150, output_tokens: 75 },
          },
        }),
      ];

      const entries = await collectEntries(lines);
      const sessionEnd = entries.find((e) => e.type === 'session.end') as SessionEnd;

      expect(sessionEnd.summary?.tokens?.input).toBe(250);
      expect(sessionEnd.summary?.tokens?.output).toBe(125);
    });

    it('includes cached tokens in message entry', async () => {
      const lines = [
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'session-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello' }],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_read_input_tokens: 500,
              cache_creation_input_tokens: 200,
            },
          },
        }),
      ];

      const entries = await collectEntries(lines);
      const message = entries.find((e) => e.type === 'message') as Message;

      expect(message.tokens?.input).toBe(100);
      expect(message.tokens?.output).toBe(50);
      expect(message.tokens?.cached).toBe(700);
    });
  });
});
