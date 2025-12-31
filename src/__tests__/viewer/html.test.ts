// src/__tests__/viewer/html.test.ts
import { describe, it, expect } from 'bun:test';
import { generateHtml } from '../../viewer/html.js';
import type { AEFEntry, SessionStart, Message, SessionEnd } from '../../types.js';

describe('generateHtml', () => {
  const entries: AEFEntry[] = [
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

import { PluginRegistry } from '../../viewer/registry.js';
import type { ViewerPlugin } from '../../viewer/plugin.js';

describe('generateHtml with plugins', () => {
  it('uses plugin renderer for matching entries', () => {
    const registry = new PluginRegistry();
    const plugin: ViewerPlugin = {
      namespace: 'custom.*',
      name: 'Custom Plugin',
      renderEntry: (entry, ctx) => ({
        html: '<div class="custom-rendered">Custom!</div>',
        entryId: entry.id,
        type: entry.type,
      }),
    };
    registry.register(plugin);

    const entries: AEFEntry[] = [
      { v: 1, id: 'ext-1', ts: 1704067200000, type: 'custom.widget.foo', sid: 'test-session' },
    ];

    const html = generateHtml(entries, {}, registry);
    expect(html).toContain('custom-rendered');
    expect(html).toContain('Custom!');
  });

  it('includes plugin styles', () => {
    const registry = new PluginRegistry();
    registry.register({
      namespace: 'styled.*',
      name: 'Styled Plugin',
      styles: '.custom-style { color: red; }',
    });

    const entries: AEFEntry[] = [
      { v: 1, id: 's1', ts: 1704067200000, type: 'session.start', sid: 'test', agent: 'test' } as SessionStart,
    ];

    const html = generateHtml(entries, {}, registry);
    expect(html).toContain('.custom-style');
  });

  it('renders aggregations', () => {
    const registry = new PluginRegistry();
    registry.register({
      namespace: 'agg.*',
      name: 'Aggregation Plugin',
      aggregations: [
        {
          name: 'summary',
          types: ['agg.item'],
          position: 'footer',
          render: (entries) => `<div class="agg-summary">Count: ${entries.length}</div>`,
        },
      ],
    });

    const entries: AEFEntry[] = [
      { v: 1, id: 's1', ts: 1704067200000, type: 'session.start', sid: 'test', agent: 'test' } as SessionStart,
      { v: 1, id: 'a1', ts: 1704067201000, type: 'agg.item', sid: 'test' },
      { v: 1, id: 'a2', ts: 1704067202000, type: 'agg.item', sid: 'test' },
    ];

    const html = generateHtml(entries, {}, registry);
    expect(html).toContain('agg-summary');
    expect(html).toContain('Count: 2');
  });
});
