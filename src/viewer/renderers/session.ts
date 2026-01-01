// src/viewer/renderers/session.ts

import type { SessionStart, SessionEnd } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp, formatDuration } from '../utils.js';

/**
 * Render a session.start entry
 */
export function renderSessionStart(entry: SessionStart, ctx: RenderContext): RenderedEntry {
  const agent = escapeHtml(entry.agent);
  const model = entry.model ? escapeHtml(entry.model) : 'unknown';
  const version = entry.version ? escapeHtml(entry.version) : '';
  const workspace = entry.workspace ? escapeHtml(entry.workspace) : '';

  let html = `<div class="aef-session-header">`;
  html += `<h1>Session: ${agent}</h1>`;
  html += `<div class="aef-session-meta">`;
  html += `<span class="aef-meta-item"><strong>Model:</strong> ${model}</span>`;
  if (version) {
    html += ` <span class="aef-meta-item"><strong>Version:</strong> ${version}</span>`;
  }
  if (workspace) {
    html += ` <span class="aef-meta-item"><strong>Workspace:</strong> ${workspace}</span>`;
  }
  html += `</div>`;
  if (ctx.options.showSequence && entry.seq !== undefined) {
    html += `<div class="aef-sequence">#${entry.seq}</div>`;
  }
  if (ctx.options.showTimestamps !== false) {
    const timestamp = formatTimestamp(entry.ts);
    html += `<div class="aef-timestamp">${timestamp}</div>`;
  }
  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'session.start',
    cssClasses: ['aef-session-start'],
  };
}

/**
 * Render a session.end entry
 */
export function renderSessionEnd(entry: SessionEnd, ctx: RenderContext): RenderedEntry {
  const status = escapeHtml(entry.status);
  const statusClass = entry.status === 'complete' ? 'aef-success' : 'aef-failure';

  let html = `<div class="aef-session-footer">`;
  html += `<div class="aef-entry-header">`;
  html += `<span class="aef-badge aef-badge-system">Session End</span>`;
  if (ctx.options.showSequence && entry.seq !== undefined) {
    html += `<span class="aef-sequence">#${entry.seq}</span>`;
  }
  if (ctx.options.showTimestamps !== false) {
    const timestamp = formatTimestamp(entry.ts);
    html += `<span class="aef-timestamp">${timestamp}</span>`;
  }
  html += `</div>`;
  html += `<div class="aef-session-status ${statusClass}">Status: ${status}</div>`;

  if (entry.summary) {
    html += `<div class="aef-session-summary">`;
    if (entry.summary.messages !== undefined) {
      html += `<span class="aef-summary-item"><strong>Messages:</strong> ${entry.summary.messages}</span> `;
    }
    if (entry.summary.tool_calls !== undefined) {
      html += `<span class="aef-summary-item"><strong>Tool Calls:</strong> ${entry.summary.tool_calls}</span> `;
    }
    if (entry.summary.duration_ms !== undefined) {
      html += `<span class="aef-summary-item"><strong>Duration:</strong> ${formatDuration(entry.summary.duration_ms)}</span> `;
    }
    if (entry.summary.tokens) {
      html += `<span class="aef-summary-item"><strong>Tokens:</strong> ${entry.summary.tokens.input} in / ${entry.summary.tokens.output} out</span>`;
    }
    html += `</div>`;
  }

  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'session.end',
    cssClasses: ['aef-session-end'],
  };
}
