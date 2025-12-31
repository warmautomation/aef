// src/viewer/renderers/session.ts

import type { SessionStart, SessionEnd } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp, formatDuration } from '../utils.js';

/**
 * Render a session.start entry
 */
export function renderSessionStart(entry: SessionStart, ctx: RenderContext): RenderedEntry {
  const timestamp = formatTimestamp(entry.ts);
  const agent = escapeHtml(entry.agent);
  const model = entry.model ? escapeHtml(entry.model) : 'unknown';
  const version = entry.version ? escapeHtml(entry.version) : '';
  const workspace = entry.workspace ? escapeHtml(entry.workspace) : '';

  let html = `<div class="alf-session-header">`;
  html += `<h1>Session: ${agent}</h1>`;
  html += `<div class="alf-session-meta">`;
  html += `<span class="alf-meta-item"><strong>Model:</strong> ${model}</span>`;
  if (version) {
    html += ` <span class="alf-meta-item"><strong>Version:</strong> ${version}</span>`;
  }
  if (workspace) {
    html += ` <span class="alf-meta-item"><strong>Workspace:</strong> ${workspace}</span>`;
  }
  html += `</div>`;
  html += `<div class="alf-timestamp">${timestamp}</div>`;
  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'session.start',
    cssClasses: ['alf-session-start'],
  };
}

/**
 * Render a session.end entry
 */
export function renderSessionEnd(entry: SessionEnd, ctx: RenderContext): RenderedEntry {
  const timestamp = formatTimestamp(entry.ts);
  const status = escapeHtml(entry.status);
  const statusClass = entry.status === 'complete' ? 'alf-success' : 'alf-failure';

  let html = `<div class="alf-session-footer">`;
  html += `<div class="alf-entry-header">`;
  html += `<span class="alf-badge alf-badge-system">Session End</span>`;
  html += `<span class="alf-timestamp">${timestamp}</span>`;
  html += `</div>`;
  html += `<div class="alf-session-status ${statusClass}">Status: ${status}</div>`;

  if (entry.summary) {
    html += `<div class="alf-session-summary">`;
    if (entry.summary.messages !== undefined) {
      html += `<span class="alf-summary-item"><strong>Messages:</strong> ${entry.summary.messages}</span> `;
    }
    if (entry.summary.tool_calls !== undefined) {
      html += `<span class="alf-summary-item"><strong>Tool Calls:</strong> ${entry.summary.tool_calls}</span> `;
    }
    if (entry.summary.duration_ms !== undefined) {
      html += `<span class="alf-summary-item"><strong>Duration:</strong> ${formatDuration(entry.summary.duration_ms)}</span> `;
    }
    if (entry.summary.tokens) {
      html += `<span class="alf-summary-item"><strong>Tokens:</strong> ${entry.summary.tokens.input} in / ${entry.summary.tokens.output} out</span>`;
    }
    html += `</div>`;
  }

  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'session.end',
    cssClasses: ['alf-session-end'],
  };
}
