// src/viewer/renderers/tool.ts

import type { ToolCall, ToolResult } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp, formatDuration, truncate } from '../utils.js';

/**
 * Render tool arguments in a readable format
 */
function renderArgs(args: Record<string, unknown>, maxLength?: number): string {
  const json = JSON.stringify(args, null, 2);
  const truncated = maxLength ? truncate(json, maxLength) : json;
  return escapeHtml(truncated);
}

/**
 * Render a tool result value
 */
function renderResult(result: unknown, maxLength?: number): string {
  if (result === undefined || result === null) {
    return '';
  }

  if (typeof result === 'string') {
    const truncated = maxLength ? truncate(result, maxLength) : result;
    return escapeHtml(truncated);
  }

  const json = JSON.stringify(result, null, 2);
  const truncated = maxLength ? truncate(json, maxLength) : json;
  return escapeHtml(truncated);
}

/**
 * Render a tool.call entry
 */
export function renderToolCall(entry: ToolCall, ctx: RenderContext): RenderedEntry {
  const toolName = escapeHtml(entry.tool);
  const args = renderArgs(entry.args, ctx.options.maxContentLength);

  let html = `<div class="aef-entry-header">`;
  html += `<span class="aef-badge aef-badge-tool">Tool Call</span>`;
  html += `<span class="aef-tool-name">${toolName}</span>`;
  if (ctx.options.showSequence && entry.seq !== undefined) {
    html += `<span class="aef-sequence">#${entry.seq}</span>`;
  }
  if (ctx.options.showTimestamps !== false) {
    const timestamp = formatTimestamp(entry.ts);
    html += `<span class="aef-timestamp">${timestamp}</span>`;
  }
  html += `</div>`;

  html += `<div class="aef-tool-args">`;
  html += `<pre class="aef-code">${args}</pre>`;
  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'tool.call',
    cssClasses: ['aef-entry', 'aef-tool-call'],
  };
}

/**
 * Render a tool.result entry
 */
export function renderToolResult(entry: ToolResult, ctx: RenderContext): RenderedEntry {
  const toolName = escapeHtml(entry.tool);
  const statusClass = entry.success ? 'aef-success' : 'aef-failure';
  const statusLabel = entry.success ? 'Success' : 'Failed';
  const collapsibleClass = ctx.options.collapsedTools ? ' aef-collapsible' : '';

  let html = `<div class="aef-entry-header${collapsibleClass}">`;
  html += `<span class="aef-badge aef-badge-tool">Tool Result</span>`;
  html += `<span class="aef-tool-name">${toolName}</span>`;
  html += `<span class="${statusClass}">${statusLabel}</span>`;
  if (entry.duration_ms !== undefined) {
    html += `<span class="aef-duration">${formatDuration(entry.duration_ms)}</span>`;
  }
  if (ctx.options.showSequence && entry.seq !== undefined) {
    html += `<span class="aef-sequence">#${entry.seq}</span>`;
  }
  if (ctx.options.showTimestamps !== false) {
    const timestamp = formatTimestamp(entry.ts);
    html += `<span class="aef-timestamp">${timestamp}</span>`;
  }
  html += `</div>`;

  // Render result or error
  if (entry.success && entry.result !== undefined) {
    const result = renderResult(entry.result, ctx.options.maxContentLength);
    const contentClass = ctx.options.collapsedTools ? 'aef-tool-output aef-collapsible-content' : 'aef-tool-output';
    html += `<div class="${contentClass}">`;
    html += `<pre class="aef-code">${result}</pre>`;
    html += `</div>`;
  } else if (!entry.success && entry.error) {
    html += `<div class="aef-tool-error ${statusClass}">`;
    if (entry.error.code) {
      html += `<span class="aef-error-code">[${escapeHtml(entry.error.code)}]</span> `;
    }
    html += `<span class="aef-error-message">${escapeHtml(entry.error.message)}</span>`;
    html += `</div>`;
  }

  return {
    html,
    entryId: entry.id,
    type: 'tool.result',
    cssClasses: ['aef-entry', 'aef-tool-result', statusClass],
  };
}
