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
  const timestamp = formatTimestamp(entry.ts);
  const toolName = escapeHtml(entry.tool);
  const args = renderArgs(entry.args, ctx.options.maxContentLength);

  let html = `<div class="alf-entry-header">`;
  html += `<span class="alf-badge alf-badge-tool">Tool Call</span>`;
  html += `<span class="alf-tool-name">${toolName}</span>`;
  html += `<span class="alf-timestamp">${timestamp}</span>`;
  html += `</div>`;

  html += `<div class="alf-tool-args">`;
  html += `<pre class="alf-code">${args}</pre>`;
  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'tool.call',
    cssClasses: ['alf-entry', 'alf-tool-call'],
  };
}

/**
 * Render a tool.result entry
 */
export function renderToolResult(entry: ToolResult, ctx: RenderContext): RenderedEntry {
  const timestamp = formatTimestamp(entry.ts);
  const toolName = escapeHtml(entry.tool);
  const statusClass = entry.success ? 'alf-success' : 'alf-failure';
  const statusLabel = entry.success ? 'Success' : 'Failed';

  let html = `<div class="alf-entry-header">`;
  html += `<span class="alf-badge alf-badge-tool">Tool Result</span>`;
  html += `<span class="alf-tool-name">${toolName}</span>`;
  html += `<span class="${statusClass}">${statusLabel}</span>`;
  if (entry.duration_ms !== undefined) {
    html += `<span class="alf-duration">${formatDuration(entry.duration_ms)}</span>`;
  }
  html += `<span class="alf-timestamp">${timestamp}</span>`;
  html += `</div>`;

  // Render result or error
  if (entry.success && entry.result !== undefined) {
    const result = renderResult(entry.result, ctx.options.maxContentLength);
    html += `<div class="alf-tool-output">`;
    html += `<pre class="alf-code">${result}</pre>`;
    html += `</div>`;
  } else if (!entry.success && entry.error) {
    html += `<div class="alf-tool-error ${statusClass}">`;
    if (entry.error.code) {
      html += `<span class="alf-error-code">[${escapeHtml(entry.error.code)}]</span> `;
    }
    html += `<span class="alf-error-message">${escapeHtml(entry.error.message)}</span>`;
    html += `</div>`;
  }

  return {
    html,
    entryId: entry.id,
    type: 'tool.result',
    cssClasses: ['alf-entry', 'alf-tool-result', statusClass],
  };
}
