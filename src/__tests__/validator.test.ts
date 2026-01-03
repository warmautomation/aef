import { describe, it, expect } from 'bun:test';
import { validateAEFEntry, validateAEFStream } from '../validator.js';

describe('validateAEFEntry', () => {
  describe('core entry types', () => {
    it('validates a valid session.start entry', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'session.start',
        sid: 'session-abc123',
        agent: 'claude-code',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('core');
    });

    it('validates a valid session.end entry', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f7',
        ts: 1704067300000,
        type: 'session.end',
        sid: 'session-abc123',
        status: 'complete',
        summary: {
          messages: 10,
          tool_calls: 5,
          duration_ms: 100000,
          tokens: { input: 5000, output: 2000 },
        },
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('core');
    });

    it('validates a valid message entry with string content', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f8',
        ts: 1704067201000,
        type: 'message',
        sid: 'session-abc123',
        role: 'user',
        content: 'Hello, world!',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('core');
    });

    it('validates a valid message entry with content blocks', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f9',
        ts: 1704067202000,
        type: 'message',
        sid: 'session-abc123',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me help you.' },
          { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'ls' } },
        ],
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('core');
    });

    it('validates a valid tool.call entry', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5fa',
        ts: 1704067203000,
        type: 'tool.call',
        sid: 'session-abc123',
        tool: 'Bash',
        args: { command: 'ls -la' },
        call_id: 'call-1',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('core');
    });

    it('validates a valid tool.result entry', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5fb',
        ts: 1704067204000,
        type: 'tool.result',
        sid: 'session-abc123',
        tool: 'Bash',
        call_id: 'call-1',
        success: true,
        result: 'file1.txt\nfile2.txt',
        duration_ms: 50,
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('core');
    });

    it('validates a valid error entry', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5fc',
        ts: 1704067205000,
        type: 'error',
        sid: 'session-abc123',
        code: 'RATE_LIMIT',
        message: 'API rate limit exceeded',
        recoverable: true,
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('core');
    });
  });

  describe('base field validation', () => {
    it('rejects entry missing required fields', () => {
      const entry = { v: 1, type: 'message' };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.entryType).toBe('invalid');
      expect(result.errors).toBeDefined();
    });

    it('rejects entry with wrong version', () => {
      const entry = {
        v: 2, // Wrong version
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'session.start',
        sid: 'session-abc123',
        agent: 'claude-code',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.entryType).toBe('invalid');
    });

    it('rejects non-object entries', () => {
      const result = validateAEFEntry('not an object');
      expect(result.valid).toBe(false);
      expect(result.entryType).toBe('invalid');
    });

    it('rejects null entries', () => {
      const result = validateAEFEntry(null);
      expect(result.valid).toBe(false);
      expect(result.entryType).toBe('invalid');
    });
  });

  describe('extension entries', () => {
    it('passes unknown extensions with valid base fields', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'acme.custom.widget',
        sid: 'session-abc123',
        customField: 'allowed',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('validates warmhub.belief.query extension', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-ext1',
        ts: 1704067205000,
        type: 'warmhub.belief.query',
        sid: 'session-abc123',
        query: 'What is the capital of France?',
        snapshot: {
          hypotheses: [{ id: 'h1', text: 'Paris', belief: 0.95 }],
          assertions: 5,
          finish_ready: true,
        },
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('classifies entries correctly', () => {
      // Core type
      const coreEntry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'message',
        sid: 'session-abc123',
        role: 'user',
        content: 'Hello',
      };
      expect(validateAEFEntry(coreEntry).entryType).toBe('core');

      // Extension type
      const extEntry = {
        v: 1,
        id: '0194a1b2c3d4-e5f7',
        ts: 1704067200000,
        type: 'vendor.category.type',
        sid: 'session-abc123',
      };
      expect(validateAEFEntry(extEntry).entryType).toBe('extension');
    });

    it('validates extensions with 4+ segments', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'vendor.category.subcategory.type',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('validates extensions with 5 segments', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'org.team.project.module.event',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('validates extensions with hyphens in segments', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'my-company.my-category.my-type',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('validates extensions with digits and hyphens', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'vendor2.category-v1.type-2024',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('rejects extensions with only 2 segments', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'vendor.type',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(false);
    });

    it('rejects extensions with uppercase letters', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'Vendor.Category.Type',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(false);
    });

    it('rejects extensions starting with digits', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: '123vendor.category.type',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateAEFStream', () => {
  it('validates multiple entries from a stream', async () => {
    const lines = [
      '{"v":1,"id":"0194a1b2c3d4-0001","ts":1704067200000,"type":"session.start","sid":"test","agent":"test-agent"}',
      '{"v":1,"id":"0194a1b2c3d4-0002","ts":1704067201000,"type":"message","sid":"test","role":"user","content":"Hello"}',
      '{"v":1,"id":"0194a1b2c3d4-0003","ts":1704067202000,"type":"session.end","sid":"test","status":"complete"}',
    ];

    async function* lineIterator() {
      for (const line of lines) {
        yield line;
      }
    }

    const results: Array<{ line: number; valid: boolean }> = [];
    for await (const { line, result } of validateAEFStream(lineIterator())) {
      results.push({ line, valid: result.valid });
    }

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.valid)).toBe(true);
  });

  it('handles invalid JSON gracefully', async () => {
    const lines = [
      '{"v":1,"id":"0194a1b2c3d4-0001","ts":1704067200000,"type":"session.start","sid":"test","agent":"test-agent"}',
      'not valid json',
      '{"v":1,"id":"0194a1b2c3d4-0003","ts":1704067202000,"type":"message","sid":"test","role":"user","content":"Hello"}',
    ];

    async function* lineIterator() {
      for (const line of lines) {
        yield line;
      }
    }

    const results: Array<{ line: number; valid: boolean; errors?: string[] }> = [];
    for await (const { line, result } of validateAEFStream(lineIterator())) {
      results.push({ line, valid: result.valid, errors: result.errors });
    }

    expect(results).toHaveLength(3);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[1].errors?.[0]).toContain('Invalid JSON');
    expect(results[2].valid).toBe(true);
  });

  it('skips empty lines', async () => {
    const lines = ['{"v":1,"id":"id1","ts":1704067200000,"type":"session.start","sid":"test","agent":"test"}', '', '  ', '{"v":1,"id":"id2","ts":1704067201000,"type":"session.end","sid":"test","status":"complete"}'];

    async function* lineIterator() {
      for (const line of lines) {
        yield line;
      }
    }

    const results = [];
    for await (const item of validateAEFStream(lineIterator())) {
      results.push(item);
    }

    expect(results).toHaveLength(2); // Empty lines skipped
  });
});
