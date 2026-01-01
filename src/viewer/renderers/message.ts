// src/viewer/renderers/message.ts

import type { Message, ContentBlock } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp, truncate } from '../utils.js';

/**
 * Get the badge class for a message role
 */
function getBadgeClass(role: Message['role']): string {
  switch (role) {
    case 'user':
      return 'aef-badge-user';
    case 'assistant':
      return 'aef-badge-assistant';
    case 'system':
      return 'aef-badge-system';
    default:
      return 'aef-badge-system';
  }
}

/**
 * Get the message container class for a role
 */
function getMessageClass(role: Message['role']): string {
  return `aef-message-${role}`;
}

/**
 * Render content blocks to HTML
 */
function renderContentBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'text':
          return `<div class="aef-content">${escapeHtml(block.text)}</div>`;
        case 'tool_use':
          return `<div class="aef-tool-use"><span class="aef-tool-name">${escapeHtml(block.name)}</span><pre class="aef-code">${escapeHtml(JSON.stringify(block.input, null, 2))}</pre></div>`;
        case 'tool_result':
          const errorClass = block.is_error ? ' aef-failure' : '';
          return `<div class="aef-tool-result-block${errorClass}"><pre class="aef-code">${escapeHtml(block.content)}</pre></div>`;
        default:
          return '';
      }
    })
    .join('\n');
}

/**
 * Render a message entry
 */
export function renderMessage(entry: Message, ctx: RenderContext): RenderedEntry {
  const badgeClass = getBadgeClass(entry.role);
  const messageClass = getMessageClass(entry.role);
  const roleLabel = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);

  let html = `<div class="aef-entry-header">`;
  html += `<span class="aef-badge ${badgeClass}">${roleLabel}</span>`;
  if (ctx.options.showSequence && entry.seq !== undefined) {
    html += `<span class="aef-sequence">#${entry.seq}</span>`;
  }
  if (ctx.options.showTimestamps !== false) {
    const timestamp = formatTimestamp(entry.ts);
    html += `<span class="aef-timestamp">${timestamp}</span>`;
  }
  html += `</div>`;

  // Render content based on type
  if (typeof entry.content === 'string') {
    const content = ctx.options.maxContentLength
      ? truncate(entry.content, ctx.options.maxContentLength)
      : entry.content;
    html += `<div class="aef-content">${escapeHtml(content)}</div>`;
  } else if (Array.isArray(entry.content)) {
    html += renderContentBlocks(entry.content);
  }

  // Add token info if present
  if (entry.tokens) {
    html += `<div class="aef-token-info">`;
    if (entry.tokens.input !== undefined) {
      html += `<span>Input: ${entry.tokens.input}</span> `;
    }
    if (entry.tokens.output !== undefined) {
      html += `<span>Output: ${entry.tokens.output}</span> `;
    }
    if (entry.tokens.cached !== undefined) {
      html += `<span>Cached: ${entry.tokens.cached}</span>`;
    }
    html += `</div>`;
  }

  return {
    html,
    entryId: entry.id,
    type: 'message',
    cssClasses: ['aef-message', messageClass],
  };
}
