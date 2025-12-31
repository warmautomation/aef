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
      return 'alf-badge-user';
    case 'assistant':
      return 'alf-badge-assistant';
    case 'system':
      return 'alf-badge-system';
    default:
      return 'alf-badge-system';
  }
}

/**
 * Get the message container class for a role
 */
function getMessageClass(role: Message['role']): string {
  return `alf-message-${role}`;
}

/**
 * Render content blocks to HTML
 */
function renderContentBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'text':
          return `<div class="alf-content">${escapeHtml(block.text)}</div>`;
        case 'tool_use':
          return `<div class="alf-tool-use"><span class="alf-tool-name">${escapeHtml(block.name)}</span><pre class="alf-code">${escapeHtml(JSON.stringify(block.input, null, 2))}</pre></div>`;
        case 'tool_result':
          const errorClass = block.is_error ? ' alf-failure' : '';
          return `<div class="alf-tool-result-block${errorClass}"><pre class="alf-code">${escapeHtml(block.content)}</pre></div>`;
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
  const timestamp = formatTimestamp(entry.ts);
  const badgeClass = getBadgeClass(entry.role);
  const messageClass = getMessageClass(entry.role);
  const roleLabel = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);

  let html = `<div class="alf-entry-header">`;
  html += `<span class="alf-badge ${badgeClass}">${roleLabel}</span>`;
  html += `<span class="alf-timestamp">${timestamp}</span>`;
  html += `</div>`;

  // Render content based on type
  if (typeof entry.content === 'string') {
    const content = ctx.options.maxContentLength
      ? truncate(entry.content, ctx.options.maxContentLength)
      : entry.content;
    html += `<div class="alf-content">${escapeHtml(content)}</div>`;
  } else if (Array.isArray(entry.content)) {
    html += renderContentBlocks(entry.content);
  }

  // Add token info if present
  if (entry.tokens) {
    html += `<div class="alf-token-info">`;
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
    cssClasses: ['alf-message', messageClass],
  };
}
