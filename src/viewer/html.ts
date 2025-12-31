// src/viewer/html.ts

import type { AEFEntry, SessionStart, SessionEnd, Message, ToolCall, ToolResult, ErrorEntry } from '../types.js';
import type { ViewerOptions, RenderContext, RenderedEntry } from './types.js';
import { getCoreStyles } from './styles.js';
import { renderSessionStart, renderSessionEnd } from './renderers/session.js';
import { renderMessage } from './renderers/message.js';
import { renderToolCall, renderToolResult } from './renderers/tool.js';
import { renderError } from './renderers/error.js';
import { escapeHtml } from './utils.js';
import { PluginRegistry, defaultRegistry } from './registry.js';

const DEFAULT_OPTIONS: ViewerOptions = {
  theme: 'light',
  collapsedTools: false,
  maxContentLength: 10000,
  showTimestamps: true,
  showSequence: false,
};

const CORE_TYPES = ['session.start', 'session.end', 'message', 'tool.call', 'tool.result', 'error'];

function isCoreType(type: string): boolean {
  return CORE_TYPES.includes(type);
}

function renderEntry(entry: AEFEntry, ctx: RenderContext): RenderedEntry | null {
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

function renderExtension(entry: AEFEntry, ctx: RenderContext): RenderedEntry {
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

function renderAggregations(
  entries: AEFEntry[],
  registry: PluginRegistry,
  opts: ViewerOptions
): { header: string; footer: string } {
  const aggregations = registry.getAggregations();
  let header = '';
  let footer = '';

  const ctx: RenderContext = {
    sessionId: entries[0]?.sid ?? 'unknown',
    entryIndex: 0,
    totalEntries: entries.length,
    options: opts,
    entries,
  };

  for (const agg of aggregations) {
    const matchingEntries = entries.filter((e) => agg.types.includes(e.type));
    if (matchingEntries.length === 0) continue;

    const html = `<div class="alf-aggregation" data-aggregation="${escapeHtml(agg.name)}">${agg.render(matchingEntries, ctx)}</div>`;

    if (agg.position === 'header') {
      header += html;
    } else {
      footer += html;
    }
  }

  return { header, footer };
}

export function generateHtml(
  entries: AEFEntry[],
  options: ViewerOptions = {},
  registry: PluginRegistry = defaultRegistry
): string {
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

    // Try plugin first for non-core types
    let rendered: RenderedEntry | null = null;
    if (!isCoreType(entry.type)) {
      const plugin = registry.findPlugin(entry.type);
      if (plugin?.renderEntry) {
        rendered = plugin.renderEntry(entry, ctx);
      }
    }

    // Fall back to core renderer
    if (!rendered) {
      rendered = renderEntry(entry, ctx);
    }

    if (rendered) {
      const classes = ['alf-entry', ...(rendered.cssClasses ?? [])].join(' ');
      renderedEntries.push(`
        <div class="${classes}" data-entry-id="${escapeHtml(rendered.entryId)}" data-entry-type="${escapeHtml(rendered.type)}">
          ${rendered.html}
        </div>
      `);
    }
  }

  const aggregationHtml = renderAggregations(entries, registry, opts);
  const pluginStyles = registry.getStyles();
  const pluginScripts = registry.getScripts();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AEF Trace - ${escapeHtml(sessionId)}</title>
  <style>
${getCoreStyles(opts.theme ?? 'light')}
${pluginStyles}
  </style>
</head>
<body>
  <div class="alf-container">
    ${aggregationHtml.header}
    ${renderedEntries.join('\n')}
    ${aggregationHtml.footer}
  </div>
  ${opts.collapsedTools ? `<script>${getCollapsibleScript()}</script>` : ''}
  ${pluginScripts ? `<script>${pluginScripts}</script>` : ''}
</body>
</html>`;
}
