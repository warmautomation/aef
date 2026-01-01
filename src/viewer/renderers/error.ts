// src/viewer/renderers/error.ts

import type { ErrorEntry } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp } from '../utils.js';

/**
 * Render an error entry
 */
export function renderError(entry: ErrorEntry, ctx: RenderContext): RenderedEntry {
  const message = escapeHtml(entry.message);
  const code = entry.code ? escapeHtml(entry.code) : null;
  const recoverable = entry.recoverable;

  let html = `<div class="aef-entry-header">`;
  html += `<span class="aef-badge aef-badge-error">Error</span>`;
  if (code) {
    html += `<span class="aef-error-code">${code}</span>`;
  }
  if (ctx.options.showSequence && entry.seq !== undefined) {
    html += `<span class="aef-sequence">#${entry.seq}</span>`;
  }
  if (ctx.options.showTimestamps !== false) {
    const timestamp = formatTimestamp(entry.ts);
    html += `<span class="aef-timestamp">${timestamp}</span>`;
  }
  html += `</div>`;

  html += `<div class="aef-error-content">`;
  html += `<div class="aef-error-message">${message}</div>`;

  if (recoverable !== undefined) {
    const recoverableLabel = recoverable ? 'recoverable' : 'non-recoverable';
    const recoverableClass = recoverable ? 'aef-warning' : 'aef-failure';
    html += `<div class="aef-error-recoverable ${recoverableClass}">${recoverableLabel}</div>`;
  }

  if (entry.stack) {
    html += `<details class="aef-error-stack">`;
    html += `<summary>Stack Trace</summary>`;
    html += `<pre class="aef-code">${escapeHtml(entry.stack)}</pre>`;
    html += `</details>`;
  }

  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'error',
    cssClasses: ['aef-entry', 'aef-error'],
  };
}
