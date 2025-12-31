// src/__tests__/viewer/utils.test.ts
import { describe, it, expect } from 'bun:test';
import { escapeHtml, formatTimestamp, formatDuration, truncate } from '../../viewer/utils.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('formatTimestamp', () => {
  it('formats Unix ms timestamp to ISO string', () => {
    const ts = 1704067200000; // 2024-01-01T00:00:00.000Z
    expect(formatTimestamp(ts)).toMatch(/2024-01-01/);
  });
});

describe('formatDuration', () => {
  it('formats milliseconds to human readable', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(65000)).toBe('1m 5s');
  });
});

describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    const long = 'a'.repeat(100);
    expect(truncate(long, 50)).toBe('a'.repeat(47) + '...');
  });

  it('returns short strings unchanged', () => {
    expect(truncate('short', 50)).toBe('short');
  });
});
