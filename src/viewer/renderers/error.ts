// src/viewer/renderers/error.ts

import type { ErrorEntry } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp } from '../utils.js';

/**
 * Render an error entry
 */
export function renderError(entry: ErrorEntry, ctx: RenderContext): RenderedEntry {
  const timestamp = formatTimestamp(entry.ts);
  const message = escapeHtml(entry.message);
  const code = entry.code ? escapeHtml(entry.code) : null;
  const recoverable = entry.recoverable;

  let html = `<div class="alf-entry-header">`;
  html += `<span class="alf-badge alf-badge-error">Error</span>`;
  if (code) {
    html += `<span class="alf-error-code">${code}</span>`;
  }
  html += `<span class="alf-timestamp">${timestamp}</span>`;
  html += `</div>`;

  html += `<div class="alf-error-content">`;
  html += `<div class="alf-error-message">${message}</div>`;

  if (recoverable !== undefined) {
    const recoverableLabel = recoverable ? 'recoverable' : 'non-recoverable';
    const recoverableClass = recoverable ? 'alf-warning' : 'alf-failure';
    html += `<div class="alf-error-recoverable ${recoverableClass}">${recoverableLabel}</div>`;
  }

  if (entry.stack) {
    html += `<details class="alf-error-stack">`;
    html += `<summary>Stack Trace</summary>`;
    html += `<pre class="alf-code">${escapeHtml(entry.stack)}</pre>`;
    html += `</details>`;
  }

  html += `</div>`;

  return {
    html,
    entryId: entry.id,
    type: 'error',
    cssClasses: ['alf-entry', 'alf-error'],
  };
}
