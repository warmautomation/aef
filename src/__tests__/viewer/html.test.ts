// src/__tests__/viewer/html.test.ts
import { describe, it, expect } from 'bun:test';
import { generateHtml } from '../../viewer/html.js';
import type { ALFEntry, SessionStart, Message, SessionEnd } from '../../types.js';

describe('generateHtml', () => {
  const entries: ALFEntry[] = [
    {
      v: 1, id: 'sess-1', ts: 1704067200000, type: 'session.start',
      sid: 'test-session', agent: 'claude-code',
    } as SessionStart,
    {
      v: 1, id: 'msg-1', ts: 1704067201000, type: 'message',
      sid: 'test-session', role: 'user', content: 'Hello',
    } as Message,
    {
      v: 1, id: 'sess-end', ts: 1704067300000, type: 'session.end',
      sid: 'test-session', status: 'complete',
    } as SessionEnd,
  ];

  it('generates complete HTML document', () => {
    const html = generateHtml(entries);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes CSS styles', () => {
    const html = generateHtml(entries);
    expect(html).toContain('<style>');
    expect(html).toContain('.alf-entry');
  });

  it('renders all entries', () => {
    const html = generateHtml(entries);
    expect(html).toContain('claude-code');
    expect(html).toContain('Hello');
    expect(html).toContain('complete');
  });

  it('supports dark theme', () => {
    const html = generateHtml(entries, { theme: 'dark' });
    expect(html).toContain('#1e1e1e');
  });

  it('includes collapsible JS when enabled', () => {
    const html = generateHtml(entries, { collapsedTools: true });
    expect(html).toContain('alf-collapsible');
  });
});
