// src/viewer/html.ts

import type { ALFEntry, SessionStart, SessionEnd, Message, ToolCall, ToolResult, ErrorEntry } from '../types.js';
import type { ViewerOptions, RenderContext, RenderedEntry } from './types.js';
import { getCoreStyles } from './styles.js';
import { renderSessionStart, renderSessionEnd } from './renderers/session.js';
import { renderMessage } from './renderers/message.js';
import { renderToolCall, renderToolResult } from './renderers/tool.js';
import { renderError } from './renderers/error.js';
import { escapeHtml } from './utils.js';

const DEFAULT_OPTIONS: ViewerOptions = {
  theme: 'light',
  collapsedTools: false,
  maxContentLength: 10000,
  showTimestamps: true,
  showSequence: false,
};

function renderEntry(entry: ALFEntry, ctx: RenderContext): RenderedEntry | null {
  switch (entry.type) {
    case 'session.start':
      return renderSessionStart(entry as SessionStart, ctx);
    case 'session.end':
      return renderSessionEnd(entry as SessionEnd, ctx);
    case 'message':
      return renderMessage(entry as Message, ctx);
    case 'tool.call':
      return renderToolCall(entry as ToolCall, ctx);
    case 'tool.result':
      return renderToolResult(entry as ToolResult, ctx);
    case 'error':
      return renderError(entry as ErrorEntry, ctx);
    default:
      return renderExtension(entry, ctx);
  }
}

function renderExtension(entry: ALFEntry, ctx: RenderContext): RenderedEntry {
  const html = `
    <div class="alf-entry-header">
      <span class="alf-badge alf-badge-system">ext</span>
      <span class="alf-extension-type">${escapeHtml(entry.type)}</span>
    </div>
    <pre class="alf-code">${escapeHtml(JSON.stringify(entry, null, 2))}</pre>
  `;
  return { html, entryId: entry.id, type: entry.type, cssClasses: ['alf-extension'] };
}

function getCollapsibleScript(): string {
  return `
    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('.alf-collapsible').forEach(function(el) {
        el.addEventListener('click', function() {
          this.classList.toggle('expanded');
        });
      });
    });
  `;
}

export function generateHtml(entries: ALFEntry[], options: ViewerOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sessionId = entries[0]?.sid ?? 'unknown';

  const renderedEntries: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ctx: RenderContext = {
      sessionId,
      entryIndex: i,
      totalEntries: entries.length,
      options: opts,
      entries,
    };

    const rendered = renderEntry(entry, ctx);
    if (rendered) {
      const classes = ['alf-entry', ...(rendered.cssClasses ?? [])].join(' ');
      renderedEntries.push(`
        <div class="${classes}" data-entry-id="${escapeHtml(rendered.entryId)}" data-entry-type="${escapeHtml(rendered.type)}">
          ${rendered.html}
        </div>
      `);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ALF Trace - ${escapeHtml(sessionId)}</title>
  <style>
${getCoreStyles(opts.theme ?? 'light')}
  </style>
</head>
<body>
  <div class="alf-container">
    ${renderedEntries.join('\n')}
  </div>
  ${opts.collapsedTools ? `<script>${getCollapsibleScript()}</script>` : ''}
</body>
</html>`;
}
