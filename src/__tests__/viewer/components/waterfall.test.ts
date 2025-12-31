// src/__tests__/viewer/components/waterfall.test.ts

import { describe, it, expect } from 'bun:test';
import {
  generateWaterfall,
  generateCompactWaterfall,
  getWaterfallStyles,
  extractWaterfallFromToolEntries,
  type WaterfallItem,
} from '../../../viewer/components/waterfall.js';

describe('generateWaterfall', () => {
  const sampleItems: WaterfallItem[] = [
    { id: '1', label: 'Search', startMs: 0, durationMs: 100, category: 'tool' },
    { id: '2', label: 'LLM Call', startMs: 100, durationMs: 500, category: 'llm' },
    { id: '3', label: 'API Request', startMs: 600, durationMs: 200, category: 'api' },
  ];

  it('generates HTML structure', () => {
    const html = generateWaterfall(sampleItems);
    expect(html).toContain('aef-waterfall');
    expect(html).toContain('aef-waterfall-row');
    expect(html).toContain('aef-waterfall-bar');
  });

  it('includes labels', () => {
    const html = generateWaterfall(sampleItems);
    expect(html).toContain('Search');
    expect(html).toContain('LLM Call');
    expect(html).toContain('API Request');
  });

  it('applies category classes', () => {
    const html = generateWaterfall(sampleItems);
    expect(html).toContain('aef-waterfall-bar-tool');
    expect(html).toContain('aef-waterfall-bar-llm');
    expect(html).toContain('aef-waterfall-bar-api');
  });

  it('handles empty items', () => {
    const html = generateWaterfall([]);
    expect(html).toContain('No data');
  });

  it('shows error class for failed items', () => {
    const items: WaterfallItem[] = [
      { id: '1', label: 'Failed', startMs: 0, durationMs: 100, success: false },
    ];
    const html = generateWaterfall(items);
    expect(html).toContain('aef-waterfall-bar-error');
  });

  it('shows duration labels when enabled', () => {
    const html = generateWaterfall(sampleItems, { showDuration: true });
    expect(html).toContain('100ms');
    expect(html).toContain('500ms');
  });

  it('shows axis when enabled', () => {
    const html = generateWaterfall(sampleItems, { showAxis: true });
    expect(html).toContain('aef-waterfall-axis');
    expect(html).toContain('0ms');
  });

  it('respects width option', () => {
    const html = generateWaterfall(sampleItems, { width: 1000 });
    expect(html).toContain('width: 1000px');
  });

  it('includes tooltip content', () => {
    const items: WaterfallItem[] = [
      { id: '1', label: 'Test', startMs: 0, durationMs: 100, meta: { key: 'value' } },
    ];
    const html = generateWaterfall(items);
    expect(html).toContain('aef-waterfall-tooltip');
    expect(html).toContain('key: value');
  });
});

describe('generateCompactWaterfall', () => {
  const sampleItems: WaterfallItem[] = [
    { id: '1', label: 'A', startMs: 0, durationMs: 50, category: 'tool' },
    { id: '2', label: 'B', startMs: 50, durationMs: 100, category: 'llm' },
  ];

  it('generates SVG element', () => {
    const svg = generateCompactWaterfall(sampleItems);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('creates rect elements for bars', () => {
    const svg = generateCompactWaterfall(sampleItems);
    expect(svg).toContain('<rect');
  });

  it('respects width and height', () => {
    const svg = generateCompactWaterfall(sampleItems, { width: 300, height: 30 });
    expect(svg).toContain('width="300"');
    expect(svg).toContain('height="30"');
  });

  it('handles empty items', () => {
    const svg = generateCompactWaterfall([]);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<rect x=');
  });

  it('includes title for tooltips', () => {
    const svg = generateCompactWaterfall(sampleItems);
    expect(svg).toContain('<title>');
    expect(svg).toContain('50ms');
  });
});

describe('getWaterfallStyles', () => {
  it('returns CSS string', () => {
    const css = getWaterfallStyles();
    expect(css).toContain('.aef-waterfall');
    expect(css).toContain('.aef-waterfall-row');
    expect(css).toContain('.aef-waterfall-bar');
  });

  it('applies custom colors', () => {
    const css = getWaterfallStyles({
      colors: { tool: '#123456' },
    });
    expect(css).toContain('#123456');
  });

  it('applies custom prefix', () => {
    const css = getWaterfallStyles({
      cssClassPrefix: 'my-waterfall',
    });
    expect(css).toContain('.my-waterfall');
    expect(css).toContain('.my-waterfall-row');
  });
});

describe('extractWaterfallFromToolEntries', () => {
  it('extracts waterfall items from tool entries', () => {
    const entries = [
      { type: 'tool.call', id: 'c1', ts: 1000, tool: 'Search' },
      { type: 'tool.result', id: 'r1', ts: 1100, tool: 'Search', duration_ms: 100, success: true },
    ];
    const items = extractWaterfallFromToolEntries(entries);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Search');
    expect(items[0].durationMs).toBe(100);
    expect(items[0].category).toBe('tool');
  });

  it('handles failed tool results', () => {
    const entries = [
      { type: 'tool.result', id: 'r1', ts: 1100, tool: 'Search', duration_ms: 50, success: false },
    ];
    const items = extractWaterfallFromToolEntries(entries);
    expect(items[0].success).toBe(false);
  });

  it('handles missing duration', () => {
    const entries = [
      { type: 'tool.result', id: 'r1', ts: 1100, tool: 'Search', success: true },
    ];
    const items = extractWaterfallFromToolEntries(entries);
    expect(items).toHaveLength(1);
    expect(items[0].durationMs).toBeGreaterThan(0);
  });
});
