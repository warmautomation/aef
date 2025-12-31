// src/__tests__/viewer/renderers.test.ts
import { describe, it, expect } from 'bun:test';
import { renderSessionStart, renderSessionEnd } from '../../viewer/renderers/session.js';
import { renderMessage } from '../../viewer/renderers/message.js';
import { renderToolCall, renderToolResult } from '../../viewer/renderers/tool.js';
import { renderError } from '../../viewer/renderers/error.js';
import type { SessionStart, SessionEnd, Message, ToolCall, ToolResult, ErrorEntry } from '../../types.js';
import type { RenderContext } from '../../viewer/types.js';

const baseCtx: RenderContext = {
  sessionId: 'test-session',
  entryIndex: 0,
  totalEntries: 10,
  options: { theme: 'light' },
};

describe('renderSessionStart', () => {
  it('renders session header with agent name', () => {
    const entry: SessionStart = {
      v: 1, id: 'sess-1', ts: 1704067200000, type: 'session.start',
      sid: 'test-session', agent: 'claude-code', model: 'claude-3-opus',
    };
    const result = renderSessionStart(entry, baseCtx);
    expect(result.html).toContain('claude-code');
    expect(result.html).toContain('claude-3-opus');
    expect(result.type).toBe('session.start');
  });
});

describe('renderSessionEnd', () => {
  it('renders session end with status', () => {
    const entry: SessionEnd = {
      v: 1, id: 'sess-end-1', ts: 1704070800000, type: 'session.end',
      sid: 'test-session', status: 'complete',
      summary: { messages: 10, tool_calls: 5, duration_ms: 3600000 },
    };
    const result = renderSessionEnd(entry, baseCtx);
    expect(result.html).toContain('complete');
    expect(result.html).toContain('10');
    expect(result.html).toContain('5');
    expect(result.type).toBe('session.end');
  });

  it('renders session end with error status', () => {
    const entry: SessionEnd = {
      v: 1, id: 'sess-end-2', ts: 1704070800000, type: 'session.end',
      sid: 'test-session', status: 'error',
    };
    const result = renderSessionEnd(entry, baseCtx);
    expect(result.html).toContain('error');
  });
});

describe('renderMessage', () => {
  it('renders user message with correct badge', () => {
    const entry: Message = {
      v: 1, id: 'msg-1', ts: 1704067201000, type: 'message',
      sid: 'test-session', role: 'user', content: 'Hello, world!',
    };
    const result = renderMessage(entry, baseCtx);
    expect(result.html).toContain('Hello, world!');
    expect(result.html).toContain('aef-badge-user');
    expect(result.cssClasses).toContain('aef-message-user');
  });

  it('renders assistant message', () => {
    const entry: Message = {
      v: 1, id: 'msg-2', ts: 1704067202000, type: 'message',
      sid: 'test-session', role: 'assistant', content: 'I can help with that.',
    };
    const result = renderMessage(entry, baseCtx);
    expect(result.html).toContain('I can help with that.');
    expect(result.html).toContain('aef-badge-assistant');
  });

  it('renders system message', () => {
    const entry: Message = {
      v: 1, id: 'msg-3', ts: 1704067203000, type: 'message',
      sid: 'test-session', role: 'system', content: 'You are a helpful assistant.',
    };
    const result = renderMessage(entry, baseCtx);
    expect(result.html).toContain('You are a helpful assistant.');
    expect(result.html).toContain('aef-badge-system');
  });

  it('escapes HTML in content', () => {
    const entry: Message = {
      v: 1, id: 'msg-4', ts: 1704067204000, type: 'message',
      sid: 'test-session', role: 'user', content: '<script>alert("xss")</script>',
    };
    const result = renderMessage(entry, baseCtx);
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });
});

describe('renderToolCall', () => {
  it('renders tool call with name and args', () => {
    const entry: ToolCall = {
      v: 1, id: 'tool-1', ts: 1704067203000, type: 'tool.call',
      sid: 'test-session', tool: 'Bash', args: { command: 'ls -la' },
    };
    const result = renderToolCall(entry, baseCtx);
    expect(result.html).toContain('Bash');
    expect(result.html).toContain('ls -la');
    expect(result.type).toBe('tool.call');
  });

  it('renders tool call with complex args', () => {
    const entry: ToolCall = {
      v: 1, id: 'tool-2', ts: 1704067204000, type: 'tool.call',
      sid: 'test-session', tool: 'Read', args: { file_path: '/path/to/file.ts', offset: 0, limit: 100 },
    };
    const result = renderToolCall(entry, baseCtx);
    expect(result.html).toContain('Read');
    expect(result.html).toContain('/path/to/file.ts');
  });
});

describe('renderToolResult', () => {
  it('renders successful tool result', () => {
    const entry: ToolResult = {
      v: 1, id: 'result-1', ts: 1704067204000, type: 'tool.result',
      sid: 'test-session', tool: 'Bash', success: true,
      result: 'file1.txt\nfile2.txt', duration_ms: 50,
    };
    const result = renderToolResult(entry, baseCtx);
    expect(result.html).toContain('file1.txt');
    expect(result.html).toContain('50ms');
    expect(result.html).toContain('aef-success');
  });

  it('renders failed tool result with error', () => {
    const entry: ToolResult = {
      v: 1, id: 'result-2', ts: 1704067205000, type: 'tool.result',
      sid: 'test-session', tool: 'Bash', success: false,
      error: { code: 'ENOENT', message: 'File not found' },
    };
    const result = renderToolResult(entry, baseCtx);
    expect(result.html).toContain('File not found');
    expect(result.html).toContain('aef-failure');
  });

  it('renders tool result without duration', () => {
    const entry: ToolResult = {
      v: 1, id: 'result-3', ts: 1704067206000, type: 'tool.result',
      sid: 'test-session', tool: 'Read', success: true,
      result: 'file contents here',
    };
    const result = renderToolResult(entry, baseCtx);
    expect(result.html).toContain('file contents here');
    expect(result.type).toBe('tool.result');
  });
});

describe('renderError', () => {
  it('renders error with code and message', () => {
    const entry: ErrorEntry = {
      v: 1, id: 'err-1', ts: 1704067206000, type: 'error',
      sid: 'test-session', code: 'RATE_LIMIT',
      message: 'API rate limit exceeded', recoverable: true,
    };
    const result = renderError(entry, baseCtx);
    expect(result.html).toContain('RATE_LIMIT');
    expect(result.html).toContain('API rate limit exceeded');
    expect(result.html).toContain('recoverable');
  });

  it('renders non-recoverable error', () => {
    const entry: ErrorEntry = {
      v: 1, id: 'err-2', ts: 1704067207000, type: 'error',
      sid: 'test-session', code: 'FATAL',
      message: 'Unrecoverable error', recoverable: false,
    };
    const result = renderError(entry, baseCtx);
    expect(result.html).toContain('FATAL');
    expect(result.html).toContain('Unrecoverable error');
  });

  it('renders error without code', () => {
    const entry: ErrorEntry = {
      v: 1, id: 'err-3', ts: 1704067208000, type: 'error',
      sid: 'test-session',
      message: 'Something went wrong',
    };
    const result = renderError(entry, baseCtx);
    expect(result.html).toContain('Something went wrong');
    expect(result.type).toBe('error');
  });

  it('renders error with stack trace', () => {
    const entry: ErrorEntry = {
      v: 1, id: 'err-4', ts: 1704067209000, type: 'error',
      sid: 'test-session',
      message: 'TypeError occurred',
      stack: 'Error: TypeError\n  at foo.ts:10\n  at bar.ts:20',
    };
    const result = renderError(entry, baseCtx);
    expect(result.html).toContain('TypeError occurred');
    expect(result.html).toContain('foo.ts:10');
  });
});
