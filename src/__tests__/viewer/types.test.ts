import { describe, it, expect } from 'bun:test';
import type { RenderContext, ViewerOptions, RenderedEntry } from '../../viewer/types.js';

describe('viewer types', () => {
  it('RenderContext has required properties', () => {
    const ctx: RenderContext = {
      sessionId: 'test-session',
      entryIndex: 0,
      totalEntries: 10,
      options: { theme: 'light' },
    };
    expect(ctx.sessionId).toBe('test-session');
    expect(ctx.entryIndex).toBe(0);
  });

  it('RenderedEntry has html and optional metadata', () => {
    const rendered: RenderedEntry = {
      html: '<div>test</div>',
      entryId: 'entry-1',
      type: 'message',
    };
    expect(rendered.html).toContain('div');
    expect(rendered.type).toBe('message');
  });
});
