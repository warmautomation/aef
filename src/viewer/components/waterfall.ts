// src/viewer/components/waterfall.ts

/**
 * Waterfall Timeline Component
 *
 * Creates a horizontal waterfall/Gantt-style timeline showing the sequence
 * and duration of operations (tool calls, API requests, etc.).
 */

import { escapeHtml, formatDuration } from '../utils.js';

export interface WaterfallItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Start time (ms since epoch or relative to session start) */
  startMs: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Category for coloring/grouping */
  category?: 'tool' | 'llm' | 'api' | 'belief' | 'other';
  /** Whether this item was successful */
  success?: boolean;
  /** Optional parent ID for nesting */
  parentId?: string;
  /** Additional metadata to show on hover */
  meta?: Record<string, string | number>;
}

export interface WaterfallOptions {
  /** Total width in pixels */
  width?: number;
  /** Row height in pixels */
  rowHeight?: number;
  /** Left padding for labels */
  labelWidth?: number;
  /** Show duration labels on bars */
  showDuration?: boolean;
  /** Show timing axis */
  showAxis?: boolean;
  /** Minimum bar width for very short durations */
  minBarWidth?: number;
  /** CSS class prefix */
  cssClassPrefix?: string;
  /** Color scheme */
  colors?: {
    tool?: string;
    llm?: string;
    api?: string;
    belief?: string;
    other?: string;
    error?: string;
    background?: string;
    border?: string;
    text?: string;
  };
}

const DEFAULT_OPTIONS: WaterfallOptions = {
  width: 800,
  rowHeight: 28,
  labelWidth: 160,
  showDuration: true,
  showAxis: true,
  minBarWidth: 4,
  cssClassPrefix: 'aef-waterfall',
  colors: {
    tool: '#f59e0b',
    llm: '#8b5cf6',
    api: '#3b82f6',
    belief: '#10b981',
    other: '#6b7280',
    error: '#ef4444',
    background: '#f8fafc',
    border: '#e2e8f0',
    text: '#1e293b',
  },
};

/**
 * Generate the CSS styles for the waterfall component
 */
export function getWaterfallStyles(options: WaterfallOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { cssClassPrefix, colors } = opts;
  const c = { ...DEFAULT_OPTIONS.colors, ...colors };

  return `
.${cssClassPrefix} {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  background: ${c.background};
  border: 1px solid ${c.border};
  border-radius: 6px;
  overflow: hidden;
}

.${cssClassPrefix}-header {
  display: flex;
  padding: 8px 12px;
  border-bottom: 1px solid ${c.border};
  font-weight: 600;
  color: ${c.text};
}

.${cssClassPrefix}-row {
  display: flex;
  align-items: center;
  height: ${opts.rowHeight}px;
  border-bottom: 1px solid ${c.border};
}

.${cssClassPrefix}-row:last-child {
  border-bottom: none;
}

.${cssClassPrefix}-row:hover {
  background: rgba(0, 0, 0, 0.02);
}

.${cssClassPrefix}-label {
  width: ${opts.labelWidth}px;
  padding: 0 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  color: ${c.text};
}

.${cssClassPrefix}-timeline {
  flex: 1;
  position: relative;
  height: 100%;
}

.${cssClassPrefix}-bar {
  position: absolute;
  height: 18px;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  min-width: ${opts.minBarWidth}px;
}

.${cssClassPrefix}-bar-tool { background: ${c.tool}; }
.${cssClassPrefix}-bar-llm { background: ${c.llm}; }
.${cssClassPrefix}-bar-api { background: ${c.api}; }
.${cssClassPrefix}-bar-belief { background: ${c.belief}; }
.${cssClassPrefix}-bar-other { background: ${c.other}; }
.${cssClassPrefix}-bar-error { background: ${c.error}; }

.${cssClassPrefix}-axis {
  display: flex;
  justify-content: space-between;
  padding: 4px ${opts.labelWidth}px 4px 12px;
  font-size: 10px;
  color: ${c.text};
  opacity: 0.6;
  border-top: 1px solid ${c.border};
}

.${cssClassPrefix}-tooltip {
  position: absolute;
  background: #1e293b;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  z-index: 100;
  pointer-events: none;
  display: none;
}

.${cssClassPrefix}-row:hover .${cssClassPrefix}-tooltip {
  display: block;
}
`;
}

/**
 * Generate a waterfall timeline visualization
 */
export function generateWaterfall(items: WaterfallItem[], options: WaterfallOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, rowHeight, labelWidth, showDuration, showAxis, minBarWidth, cssClassPrefix, colors } = opts;

  if (!items || items.length === 0) {
    return `<div class="${cssClassPrefix}"><div class="${cssClassPrefix}-header">No data</div></div>`;
  }

  // Calculate time range
  const startTimes = items.map((i) => i.startMs);
  const endTimes = items.map((i) => i.startMs + i.durationMs);
  const minTime = Math.min(...startTimes);
  const maxTime = Math.max(...endTimes);
  const totalDuration = maxTime - minTime || 1;

  const timelineWidth = (width ?? 800) - (labelWidth ?? 160);

  // Build rows
  const rows = items.map((item) => {
    const offsetPercent = ((item.startMs - minTime) / totalDuration) * 100;
    const widthPercent = Math.max((item.durationMs / totalDuration) * 100, (minBarWidth ?? 4) / timelineWidth * 100);

    const barClass = item.success === false
      ? `${cssClassPrefix}-bar-error`
      : `${cssClassPrefix}-bar-${item.category ?? 'other'}`;

    const durationLabel = showDuration && item.durationMs >= 10 ? formatDuration(item.durationMs) : '';

    // Build tooltip content
    const tooltipContent = [
      `<strong>${escapeHtml(item.label)}</strong>`,
      `Duration: ${formatDuration(item.durationMs)}`,
      item.success === false ? '<span style="color: #ef4444">Failed</span>' : '',
      ...(item.meta
        ? Object.entries(item.meta).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`)
        : []),
    ]
      .filter(Boolean)
      .join('<br>');

    return `
      <div class="${cssClassPrefix}-row" data-item-id="${escapeHtml(item.id)}">
        <div class="${cssClassPrefix}-label" title="${escapeHtml(item.label)}">
          ${escapeHtml(item.label)}
        </div>
        <div class="${cssClassPrefix}-timeline">
          <div
            class="${cssClassPrefix}-bar ${barClass}"
            style="left: ${offsetPercent.toFixed(2)}%; width: ${widthPercent.toFixed(2)}%;"
          >
            ${durationLabel}
          </div>
          <div class="${cssClassPrefix}-tooltip" style="left: ${offsetPercent.toFixed(2)}%; top: ${(rowHeight ?? 28) + 4}px;">
            ${tooltipContent}
          </div>
        </div>
      </div>
    `;
  });

  // Build axis
  const axisHtml = showAxis
    ? `
      <div class="${cssClassPrefix}-axis">
        <span>0ms</span>
        <span>${formatDuration(totalDuration / 4)}</span>
        <span>${formatDuration(totalDuration / 2)}</span>
        <span>${formatDuration((totalDuration * 3) / 4)}</span>
        <span>${formatDuration(totalDuration)}</span>
      </div>
    `
    : '';

  return `
    <div class="${cssClassPrefix}" style="width: ${width}px;">
      <div class="${cssClassPrefix}-header">
        <div class="${cssClassPrefix}-label">Operation</div>
        <div class="${cssClassPrefix}-timeline">Timeline</div>
      </div>
      ${rows.join('')}
      ${axisHtml}
    </div>
  `;
}

/**
 * Generate a compact waterfall for inline display
 */
export function generateCompactWaterfall(
  items: WaterfallItem[],
  options: Omit<WaterfallOptions, 'width' | 'rowHeight' | 'labelWidth' | 'showAxis'> & {
    width?: number;
    height?: number;
  } = {}
): string {
  const { width = 200, height = 20 } = options;

  if (!items || items.length === 0) {
    return `<svg width="${width}" height="${height}"></svg>`;
  }

  // Calculate time range
  const startTimes = items.map((i) => i.startMs);
  const endTimes = items.map((i) => i.startMs + i.durationMs);
  const minTime = Math.min(...startTimes);
  const maxTime = Math.max(...endTimes);
  const totalDuration = maxTime - minTime || 1;

  const colors = { ...DEFAULT_OPTIONS.colors, ...options.colors };

  const bars = items.map((item, idx) => {
    const x = ((item.startMs - minTime) / totalDuration) * width;
    const barWidth = Math.max((item.durationMs / totalDuration) * width, 2);
    const color = item.success === false
      ? colors.error
      : colors[item.category ?? 'other'] ?? colors.other;

    return `<rect x="${x.toFixed(1)}" y="2" width="${barWidth.toFixed(1)}" height="${height - 4}" rx="2" fill="${color}" opacity="0.8">
      <title>${escapeHtml(item.label)}: ${formatDuration(item.durationMs)}</title>
    </rect>`;
  });

  return `<svg width="${width}" height="${height}" class="aef-waterfall-compact">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f1f5f9" rx="3" />
  ${bars.join('\n  ')}
</svg>`;
}

/**
 * Extract waterfall items from AEF tool.call/tool.result entries
 */
export function extractWaterfallFromToolEntries(
  entries: Array<{ type: string; id: string; ts: number; tool?: string; duration_ms?: number; success?: boolean }>
): WaterfallItem[] {
  const toolCalls = new Map<string, { ts: number; tool: string }>();
  const items: WaterfallItem[] = [];

  for (const entry of entries) {
    if (entry.type === 'tool.call' && entry.tool) {
      toolCalls.set(entry.id, { ts: entry.ts, tool: entry.tool });
    } else if (entry.type === 'tool.result' && entry.tool) {
      // Try to find matching call by scanning backwards
      const call = Array.from(toolCalls.values()).find((c) => c.tool === entry.tool);
      const startMs = call?.ts ?? entry.ts - (entry.duration_ms ?? 100);
      const durationMs = entry.duration_ms ?? (entry.ts - startMs);

      items.push({
        id: entry.id,
        label: entry.tool,
        startMs,
        durationMs,
        category: 'tool',
        success: entry.success,
      });
    }
  }

  return items;
}
