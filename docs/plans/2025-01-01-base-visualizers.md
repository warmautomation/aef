# AEF Base Visualizers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a plugin-based HTML viewer for AEF traces with core type rendering and extension support.

**Architecture:** Scenario B (Plugin Architecture) from aef-viz.md. Core viewer handles standard AEF types (`session.*`, `message`, `tool.*`, `error`). Plugins register for namespaced extensions via a registry. Output is self-contained HTML with embedded CSS/JS.

**Tech Stack:** TypeScript, Bun, embedded CSS (no external deps), inline SVG for sparklines.

---

## Phase 1: Core Viewer (AEF Types Only)

### Task 1: Viewer Types and Interfaces

**Files:**
- Create: `src/viewer/types.ts`
- Test: `src/__tests__/viewer/types.test.ts`

**Step 1: Write failing test for render context interface**

```typescript
// src/__tests__/viewer/types.test.ts
import { describe, it, expect } from 'bun:test';
import type { RenderContext, ViewerOptions, RenderedEntry } from '../../viewer/types.js';

describe('viewer types', () => {
  it('RenderContext has required properties', () => {
    const ctx: RenderContext = {
      sessionId: 'test-session',
      entryIndex: 0,
      totalEntries: 10,
      options: { theme: 'light' },
    };
    expect(ctx.sessionId).toBe('test-session');
    expect(ctx.entryIndex).toBe(0);
  });

  it('RenderedEntry has html and optional metadata', () => {
    const rendered: RenderedEntry = {
      html: '<div>test</div>',
      entryId: 'entry-1',
      type: 'message',
    };
    expect(rendered.html).toContain('div');
    expect(rendered.type).toBe('message');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/types.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the types**

```typescript
// src/viewer/types.ts
import type { AEFEntry, CoreEntry } from '../types.js';

/**
 * Options for HTML generation
 */
export interface ViewerOptions {
  /** Color theme */
  theme?: 'light' | 'dark';
  /** Collapse tool results by default */
  collapsedTools?: boolean;
  /** Maximum content length before truncation */
  maxContentLength?: number;
  /** Include entry timestamps */
  showTimestamps?: boolean;
  /** Include sequence numbers */
  showSequence?: boolean;
}

/**
 * Context passed to renderers
 */
export interface RenderContext {
  sessionId: string;
  entryIndex: number;
  totalEntries: number;
  options: ViewerOptions;
  /** All entries in session (for cross-referencing) */
  entries?: AEFEntry[];
}

/**
 * Result of rendering a single entry
 */
export interface RenderedEntry {
  html: string;
  entryId: string;
  type: string;
  /** CSS classes to add to wrapper */
  cssClasses?: string[];
}

/**
 * Entry renderer function signature
 */
export type EntryRenderer<T extends AEFEntry = AEFEntry> = (
  entry: T,
  ctx: RenderContext
) => RenderedEntry | null;
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/viewer/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/types.ts src/__tests__/viewer/types.test.ts
git commit -m "feat(viewer): add core viewer types and interfaces"
```

---

### Task 2: HTML Utilities

**Files:**
- Create: `src/viewer/utils.ts`
- Test: `src/__tests__/viewer/utils.test.ts`

**Step 1: Write failing test for escapeHtml**

```typescript
// src/__tests__/viewer/utils.test.ts
import { describe, it, expect } from 'bun:test';
import { escapeHtml, formatTimestamp, formatDuration, truncate } from '../../viewer/utils.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('formatTimestamp', () => {
  it('formats Unix ms timestamp to ISO string', () => {
    const ts = 1704067200000; // 2024-01-01T00:00:00.000Z
    expect(formatTimestamp(ts)).toMatch(/2024-01-01/);
  });
});

describe('formatDuration', () => {
  it('formats milliseconds to human readable', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(65000)).toBe('1m 5s');
  });
});

describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    const long = 'a'.repeat(100);
    expect(truncate(long, 50)).toBe('a'.repeat(47) + '...');
  });

  it('returns short strings unchanged', () => {
    expect(truncate('short', 50)).toBe('short');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/utils.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the utilities**

```typescript
// src/viewer/utils.ts

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format Unix timestamp (ms) to readable string
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Format duration in ms to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Generate a CSS class name from entry type
 */
export function typeToClass(type: string): string {
  return `alf-${type.replace(/\./g, '-')}`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/viewer/utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/utils.ts src/__tests__/viewer/utils.test.ts
git commit -m "feat(viewer): add HTML utility functions"
```

---

### Task 3: Core CSS Styles

**Files:**
- Create: `src/viewer/styles.ts`
- Test: `src/__tests__/viewer/styles.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/viewer/styles.test.ts
import { describe, it, expect } from 'bun:test';
import { getCoreStyles, getThemeVariables } from '../../viewer/styles.js';

describe('getCoreStyles', () => {
  it('returns CSS string with root variables', () => {
    const css = getCoreStyles('light');
    expect(css).toContain(':root');
    expect(css).toContain('--alf-bg');
  });

  it('includes component styles', () => {
    const css = getCoreStyles('light');
    expect(css).toContain('.alf-entry');
    expect(css).toContain('.alf-message');
    expect(css).toContain('.alf-tool-call');
  });
});

describe('getThemeVariables', () => {
  it('returns light theme variables', () => {
    const vars = getThemeVariables('light');
    expect(vars['--alf-bg']).toBe('#ffffff');
  });

  it('returns dark theme variables', () => {
    const vars = getThemeVariables('dark');
    expect(vars['--alf-bg']).toBe('#1e1e1e');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/styles.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the styles module**

```typescript
// src/viewer/styles.ts

export type Theme = 'light' | 'dark';

const LIGHT_THEME = {
  '--alf-bg': '#ffffff',
  '--alf-fg': '#1a1a1a',
  '--alf-border': '#e0e0e0',
  '--alf-muted': '#666666',
  '--alf-accent': '#0066cc',
  '--alf-success': '#22863a',
  '--alf-error': '#cb2431',
  '--alf-warning': '#b08800',
  '--alf-user-bg': '#f0f7ff',
  '--alf-assistant-bg': '#f6f8fa',
  '--alf-tool-bg': '#fffbeb',
  '--alf-error-bg': '#ffeef0',
  '--alf-code-bg': '#f6f8fa',
};

const DARK_THEME = {
  '--alf-bg': '#1e1e1e',
  '--alf-fg': '#e0e0e0',
  '--alf-border': '#404040',
  '--alf-muted': '#999999',
  '--alf-accent': '#58a6ff',
  '--alf-success': '#3fb950',
  '--alf-error': '#f85149',
  '--alf-warning': '#d29922',
  '--alf-user-bg': '#1c2d3d',
  '--alf-assistant-bg': '#2d2d2d',
  '--alf-tool-bg': '#3d3520',
  '--alf-error-bg': '#3d1f22',
  '--alf-code-bg': '#2d2d2d',
};

export function getThemeVariables(theme: Theme): Record<string, string> {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function getCoreStyles(theme: Theme): string {
  const vars = getThemeVariables(theme);
  const cssVars = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  return `
:root {
${cssVars}
}

* { box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--alf-fg);
  background: var(--alf-bg);
  margin: 0;
  padding: 20px;
}

.alf-container {
  max-width: 1200px;
  margin: 0 auto;
}

.alf-session-header {
  padding: 16px;
  border: 1px solid var(--alf-border);
  border-radius: 8px;
  margin-bottom: 16px;
  background: var(--alf-assistant-bg);
}

.alf-session-header h1 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.alf-entry {
  padding: 12px 16px;
  border: 1px solid var(--alf-border);
  border-radius: 6px;
  margin-bottom: 8px;
}

.alf-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--alf-muted);
}

.alf-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.alf-badge-user { background: var(--alf-accent); color: white; }
.alf-badge-assistant { background: var(--alf-success); color: white; }
.alf-badge-system { background: var(--alf-muted); color: white; }
.alf-badge-tool { background: var(--alf-warning); color: white; }
.alf-badge-error { background: var(--alf-error); color: white; }

.alf-message { background: var(--alf-assistant-bg); }
.alf-message-user { background: var(--alf-user-bg); }
.alf-message-assistant { background: var(--alf-assistant-bg); }

.alf-tool-call { background: var(--alf-tool-bg); }
.alf-tool-result { background: var(--alf-tool-bg); }
.alf-error { background: var(--alf-error-bg); }

.alf-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.alf-code {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  background: var(--alf-code-bg);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.alf-collapsible {
  cursor: pointer;
}

.alf-collapsible-content {
  display: none;
}

.alf-collapsible.expanded .alf-collapsible-content {
  display: block;
}

.alf-tool-name {
  font-weight: 600;
  color: var(--alf-accent);
}

.alf-duration {
  color: var(--alf-muted);
  font-size: 12px;
}

.alf-success { color: var(--alf-success); }
.alf-failure { color: var(--alf-error); }
`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/viewer/styles.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/styles.ts src/__tests__/viewer/styles.test.ts
git commit -m "feat(viewer): add core CSS styles with theme support"
```

---

### Task 4: Core Entry Renderers

**Files:**
- Create: `src/viewer/renderers/index.ts`
- Create: `src/viewer/renderers/session.ts`
- Create: `src/viewer/renderers/message.ts`
- Create: `src/viewer/renderers/tool.ts`
- Create: `src/viewer/renderers/error.ts`
- Test: `src/__tests__/viewer/renderers.test.ts`

**Step 1: Write failing test for session renderer**

```typescript
// src/__tests__/viewer/renderers.test.ts
import { describe, it, expect } from 'bun:test';
import { renderSessionStart, renderSessionEnd } from '../../viewer/renderers/session.js';
import { renderMessage } from '../../viewer/renderers/message.js';
import { renderToolCall, renderToolResult } from '../../viewer/renderers/tool.js';
import { renderError } from '../../viewer/renderers/error.js';
import type { SessionStart, SessionEnd, Message, ToolCall, ToolResult, ErrorEntry } from '../../types.js';
import type { RenderContext } from '../../viewer/types.js';

const baseCtx: RenderContext = {
  sessionId: 'test-session',
  entryIndex: 0,
  totalEntries: 10,
  options: { theme: 'light' },
};

describe('renderSessionStart', () => {
  it('renders session header with agent name', () => {
    const entry: SessionStart = {
      v: 1,
      id: 'sess-1',
      ts: 1704067200000,
      type: 'session.start',
      sid: 'test-session',
      agent: 'claude-code',
      model: 'claude-3-opus',
    };
    const result = renderSessionStart(entry, baseCtx);
    expect(result.html).toContain('claude-code');
    expect(result.html).toContain('claude-3-opus');
    expect(result.type).toBe('session.start');
  });
});

describe('renderMessage', () => {
  it('renders user message with correct badge', () => {
    const entry: Message = {
      v: 1,
      id: 'msg-1',
      ts: 1704067201000,
      type: 'message',
      sid: 'test-session',
      role: 'user',
      content: 'Hello, world!',
    };
    const result = renderMessage(entry, baseCtx);
    expect(result.html).toContain('Hello, world!');
    expect(result.html).toContain('alf-badge-user');
    expect(result.cssClasses).toContain('alf-message-user');
  });

  it('renders assistant message', () => {
    const entry: Message = {
      v: 1,
      id: 'msg-2',
      ts: 1704067202000,
      type: 'message',
      sid: 'test-session',
      role: 'assistant',
      content: 'I can help with that.',
    };
    const result = renderMessage(entry, baseCtx);
    expect(result.html).toContain('I can help with that.');
    expect(result.html).toContain('alf-badge-assistant');
  });
});

describe('renderToolCall', () => {
  it('renders tool call with name and args', () => {
    const entry: ToolCall = {
      v: 1,
      id: 'tool-1',
      ts: 1704067203000,
      type: 'tool.call',
      sid: 'test-session',
      tool: 'Bash',
      args: { command: 'ls -la' },
    };
    const result = renderToolCall(entry, baseCtx);
    expect(result.html).toContain('Bash');
    expect(result.html).toContain('ls -la');
    expect(result.type).toBe('tool.call');
  });
});

describe('renderToolResult', () => {
  it('renders successful tool result', () => {
    const entry: ToolResult = {
      v: 1,
      id: 'result-1',
      ts: 1704067204000,
      type: 'tool.result',
      sid: 'test-session',
      tool: 'Bash',
      success: true,
      result: 'file1.txt\nfile2.txt',
      duration_ms: 50,
    };
    const result = renderToolResult(entry, baseCtx);
    expect(result.html).toContain('file1.txt');
    expect(result.html).toContain('50ms');
    expect(result.html).toContain('alf-success');
  });

  it('renders failed tool result with error', () => {
    const entry: ToolResult = {
      v: 1,
      id: 'result-2',
      ts: 1704067205000,
      type: 'tool.result',
      sid: 'test-session',
      tool: 'Bash',
      success: false,
      error: { code: 'ENOENT', message: 'File not found' },
    };
    const result = renderToolResult(entry, baseCtx);
    expect(result.html).toContain('File not found');
    expect(result.html).toContain('alf-failure');
  });
});

describe('renderError', () => {
  it('renders error with code and message', () => {
    const entry: ErrorEntry = {
      v: 1,
      id: 'err-1',
      ts: 1704067206000,
      type: 'error',
      sid: 'test-session',
      code: 'RATE_LIMIT',
      message: 'API rate limit exceeded',
      recoverable: true,
    };
    const result = renderError(entry, baseCtx);
    expect(result.html).toContain('RATE_LIMIT');
    expect(result.html).toContain('API rate limit exceeded');
    expect(result.html).toContain('recoverable');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/renderers.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write session renderer**

```typescript
// src/viewer/renderers/session.ts
import type { SessionStart, SessionEnd } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp, formatDuration } from '../utils.js';

export function renderSessionStart(entry: SessionStart, ctx: RenderContext): RenderedEntry {
  const html = `
    <div class="alf-session-header">
      <h1>${escapeHtml(entry.agent)}${entry.version ? ` v${escapeHtml(entry.version)}` : ''}</h1>
      <div class="alf-entry-header">
        <span>Session: ${escapeHtml(entry.sid)}</span>
        <span>${formatTimestamp(entry.ts)}</span>
      </div>
      ${entry.model ? `<div>Model: <strong>${escapeHtml(entry.model)}</strong></div>` : ''}
      ${entry.workspace ? `<div>Workspace: <code>${escapeHtml(entry.workspace)}</code></div>` : ''}
    </div>
  `;
  return { html, entryId: entry.id, type: entry.type };
}

export function renderSessionEnd(entry: SessionEnd, ctx: RenderContext): RenderedEntry {
  const statusClass = entry.status === 'complete' ? 'alf-success' : 'alf-failure';
  const summary = entry.summary;

  const html = `
    <div class="alf-session-footer">
      <div class="alf-entry-header">
        <span class="alf-badge alf-badge-${entry.status === 'complete' ? 'assistant' : 'error'}">
          ${entry.status}
        </span>
        <span>${formatTimestamp(entry.ts)}</span>
      </div>
      ${summary ? `
        <div class="alf-summary">
          ${summary.messages ? `<span>Messages: ${summary.messages}</span>` : ''}
          ${summary.tool_calls ? `<span>Tool calls: ${summary.tool_calls}</span>` : ''}
          ${summary.duration_ms ? `<span>Duration: ${formatDuration(summary.duration_ms)}</span>` : ''}
          ${summary.tokens ? `<span>Tokens: ${summary.tokens.input} in / ${summary.tokens.output} out</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
  return { html, entryId: entry.id, type: entry.type };
}
```

**Step 4: Write message renderer**

```typescript
// src/viewer/renderers/message.ts
import type { Message, ContentBlock } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp, truncate } from '../utils.js';

function renderContentBlock(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
      return `<div class="alf-content">${escapeHtml(block.text)}</div>`;
    case 'tool_use':
      return `
        <div class="alf-tool-use">
          <span class="alf-tool-name">${escapeHtml(block.name)}</span>
          <pre class="alf-code">${escapeHtml(JSON.stringify(block.input, null, 2))}</pre>
        </div>
      `;
    case 'tool_result':
      return `
        <div class="alf-tool-result-inline ${block.is_error ? 'alf-failure' : ''}">
          <pre class="alf-code">${escapeHtml(block.content)}</pre>
        </div>
      `;
    default:
      return '';
  }
}

export function renderMessage(entry: Message, ctx: RenderContext): RenderedEntry {
  const content = typeof entry.content === 'string'
    ? `<div class="alf-content">${escapeHtml(entry.content)}</div>`
    : entry.content.map(renderContentBlock).join('\n');

  const html = `
    <div class="alf-entry-header">
      <span class="alf-badge alf-badge-${entry.role}">${entry.role}</span>
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    ${content}
    ${entry.tokens ? `
      <div class="alf-tokens">
        Tokens: ${entry.tokens.input ?? 0} in / ${entry.tokens.output ?? 0} out
        ${entry.tokens.cached ? ` (${entry.tokens.cached} cached)` : ''}
      </div>
    ` : ''}
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['alf-message', `alf-message-${entry.role}`],
  };
}
```

**Step 5: Write tool renderer**

```typescript
// src/viewer/renderers/tool.ts
import type { ToolCall, ToolResult } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp, formatDuration, truncate } from '../utils.js';

export function renderToolCall(entry: ToolCall, ctx: RenderContext): RenderedEntry {
  const argsStr = JSON.stringify(entry.args, null, 2);
  const collapsed = ctx.options.collapsedTools && argsStr.length > 200;

  const html = `
    <div class="alf-entry-header">
      <span class="alf-badge alf-badge-tool">call</span>
      <span class="alf-tool-name">${escapeHtml(entry.tool)}</span>
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    <div class="${collapsed ? 'alf-collapsible' : ''}">
      ${collapsed ? '<span class="alf-expand-hint">[click to expand]</span>' : ''}
      <pre class="alf-code ${collapsed ? 'alf-collapsible-content' : ''}">${escapeHtml(argsStr)}</pre>
    </div>
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['alf-tool-call'],
  };
}

export function renderToolResult(entry: ToolResult, ctx: RenderContext): RenderedEntry {
  const statusClass = entry.success ? 'alf-success' : 'alf-failure';
  const resultStr = entry.success
    ? (typeof entry.result === 'string' ? entry.result : JSON.stringify(entry.result, null, 2))
    : entry.error?.message ?? 'Unknown error';

  const collapsed = ctx.options.collapsedTools && resultStr.length > 500;

  const html = `
    <div class="alf-entry-header">
      <span class="alf-badge alf-badge-tool">result</span>
      <span class="alf-tool-name">${escapeHtml(entry.tool)}</span>
      <span class="${statusClass}">${entry.success ? 'success' : 'failed'}</span>
      ${entry.duration_ms ? `<span class="alf-duration">${formatDuration(entry.duration_ms)}</span>` : ''}
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    ${entry.error ? `<div class="alf-error-detail">${escapeHtml(entry.error.code ?? '')} - ${escapeHtml(entry.error.message)}</div>` : ''}
    <div class="${collapsed ? 'alf-collapsible' : ''}">
      ${collapsed ? '<span class="alf-expand-hint">[click to expand]</span>' : ''}
      <pre class="alf-code ${collapsed ? 'alf-collapsible-content' : ''}">${escapeHtml(resultStr)}</pre>
    </div>
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['alf-tool-result', statusClass],
  };
}
```

**Step 6: Write error renderer**

```typescript
// src/viewer/renderers/error.ts
import type { ErrorEntry } from '../../types.js';
import type { RenderContext, RenderedEntry } from '../types.js';
import { escapeHtml, formatTimestamp } from '../utils.js';

export function renderError(entry: ErrorEntry, ctx: RenderContext): RenderedEntry {
  const html = `
    <div class="alf-entry-header">
      <span class="alf-badge alf-badge-error">error</span>
      ${entry.code ? `<span class="alf-error-code">${escapeHtml(entry.code)}</span>` : ''}
      ${entry.recoverable !== undefined ? `<span class="alf-recoverable">${entry.recoverable ? 'recoverable' : 'fatal'}</span>` : ''}
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    <div class="alf-error-message">${escapeHtml(entry.message)}</div>
    ${entry.stack ? `<pre class="alf-code alf-stack">${escapeHtml(entry.stack)}</pre>` : ''}
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['alf-error'],
  };
}
```

**Step 7: Write renderer index**

```typescript
// src/viewer/renderers/index.ts
export { renderSessionStart, renderSessionEnd } from './session.js';
export { renderMessage } from './message.js';
export { renderToolCall, renderToolResult } from './tool.js';
export { renderError } from './error.js';
```

**Step 8: Run tests to verify they pass**

Run: `bun test src/__tests__/viewer/renderers.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add src/viewer/renderers/ src/__tests__/viewer/renderers.test.ts
git commit -m "feat(viewer): add core entry renderers for all AEF types"
```

---

### Task 5: HTML Document Generator

**Files:**
- Create: `src/viewer/html.ts`
- Test: `src/__tests__/viewer/html.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/viewer/html.test.ts
import { describe, it, expect } from 'bun:test';
import { generateHtml } from '../../viewer/html.js';
import type { AEFEntry, SessionStart, Message, SessionEnd } from '../../types.js';

describe('generateHtml', () => {
  const entries: AEFEntry[] = [
    {
      v: 1,
      id: 'sess-1',
      ts: 1704067200000,
      type: 'session.start',
      sid: 'test-session',
      agent: 'claude-code',
    } as SessionStart,
    {
      v: 1,
      id: 'msg-1',
      ts: 1704067201000,
      type: 'message',
      sid: 'test-session',
      role: 'user',
      content: 'Hello',
    } as Message,
    {
      v: 1,
      id: 'sess-end',
      ts: 1704067300000,
      type: 'session.end',
      sid: 'test-session',
      status: 'complete',
    } as SessionEnd,
  ];

  it('generates complete HTML document', () => {
    const html = generateHtml(entries);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes CSS styles', () => {
    const html = generateHtml(entries);
    expect(html).toContain('<style>');
    expect(html).toContain('.alf-entry');
  });

  it('renders all entries', () => {
    const html = generateHtml(entries);
    expect(html).toContain('claude-code');
    expect(html).toContain('Hello');
    expect(html).toContain('complete');
  });

  it('supports dark theme', () => {
    const html = generateHtml(entries, { theme: 'dark' });
    expect(html).toContain('#1e1e1e'); // dark bg color
  });

  it('includes collapsible JS when enabled', () => {
    const html = generateHtml(entries, { collapsedTools: true });
    expect(html).toContain('alf-collapsible');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/html.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the HTML generator**

```typescript
// src/viewer/html.ts
import type { AEFEntry, SessionStart, SessionEnd, Message, ToolCall, ToolResult, ErrorEntry } from '../types.js';
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
      // Extension entry - render as raw JSON
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
  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['alf-extension'],
  };
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

export function generateHtml(entries: AEFEntry[], options: ViewerOptions = {}): string {
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
  <title>AEF Trace - ${escapeHtml(sessionId)}</title>
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
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/viewer/html.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/html.ts src/__tests__/viewer/html.test.ts
git commit -m "feat(viewer): add HTML document generator"
```

---

### Task 6: Viewer Index and Exports

**Files:**
- Create: `src/viewer/index.ts`
- Modify: `src/index.ts`

**Step 1: Create viewer index**

```typescript
// src/viewer/index.ts
export { generateHtml } from './html.js';
export type { ViewerOptions, RenderContext, RenderedEntry, EntryRenderer } from './types.js';
export { getCoreStyles, getThemeVariables } from './styles.js';
export * from './renderers/index.js';
export * from './utils.js';
```

**Step 2: Update main index**

Add to `src/index.ts`:
```typescript
// Viewer exports
export * from './viewer/index.js';
```

**Step 3: Commit**

```bash
git add src/viewer/index.ts src/index.ts
git commit -m "feat(viewer): export viewer module from package"
```

---

### Task 7: CLI `view` Command

**Files:**
- Modify: `src/cli.ts`
- Test: `src/__tests__/cli-view.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/cli-view.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { $ } from 'bun';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('alf view command', () => {
  let tmpDir: string;
  let testFile: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'alf-test-'));
    testFile = join(tmpDir, 'test.jsonl');

    const entries = [
      '{"v":1,"id":"s1","ts":1704067200000,"type":"session.start","sid":"test","agent":"test-agent"}',
      '{"v":1,"id":"m1","ts":1704067201000,"type":"message","sid":"test","role":"user","content":"Hello"}',
      '{"v":1,"id":"s2","ts":1704067300000,"type":"session.end","sid":"test","status":"complete"}',
    ];
    await writeFile(testFile, entries.join('\n'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('generates HTML to stdout by default', async () => {
    const result = await $`bun src/cli.ts view ${testFile}`.quiet();
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('test-agent');
    expect(output).toContain('Hello');
  });

  it('writes to file with -o option', async () => {
    const outFile = join(tmpDir, 'output.html');
    const result = await $`bun src/cli.ts view ${testFile} -o ${outFile}`.quiet();
    expect(result.exitCode).toBe(0);

    const content = await Bun.file(outFile).text();
    expect(content).toContain('<!DOCTYPE html>');
  });

  it('supports dark theme', async () => {
    const result = await $`bun src/cli.ts view ${testFile} --theme dark`.quiet();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('#1e1e1e');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/cli-view.test.ts`
Expected: FAIL with "error: Unknown command"

**Step 3: Add view command to CLI**

Add to `src/cli.ts` after the `convert` command:

```typescript
import { generateHtml } from './viewer/html.js';
import type { ViewerOptions } from './viewer/types.js';

program
  .command('view <file>')
  .description('Generate HTML viewer for an AEF JSONL file')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('--theme <theme>', 'Color theme (light, dark)', 'light')
  .option('--collapsed', 'Collapse tool results by default')
  .action(async (file: string, options: { output?: string; theme: string; collapsed?: boolean }) => {
    const fileHandle = Bun.file(file);
    const text = await fileHandle.text();
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    const entries: AEFEntry[] = lines.map((line) => JSON.parse(line) as AEFEntry);

    const viewerOptions: ViewerOptions = {
      theme: options.theme as 'light' | 'dark',
      collapsedTools: options.collapsed ?? false,
    };

    const html = generateHtml(entries, viewerOptions);

    if (options.output) {
      await Bun.write(options.output, html);
      console.log(`Wrote HTML viewer to ${options.output}`);
    } else {
      console.log(html);
    }
  });
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/cli-view.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli.ts src/__tests__/cli-view.test.ts
git commit -m "feat(cli): add 'view' command for HTML generation"
```

---

## Phase 2: Plugin Infrastructure

### Task 8: Plugin Interface Definition

**Files:**
- Create: `src/viewer/plugin.ts`
- Test: `src/__tests__/viewer/plugin.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/viewer/plugin.test.ts
import { describe, it, expect } from 'bun:test';
import type { ViewerPlugin, PluginAggregation } from '../../viewer/plugin.js';
import { validatePlugin } from '../../viewer/plugin.js';

describe('ViewerPlugin interface', () => {
  it('validates a minimal plugin', () => {
    const plugin: ViewerPlugin = {
      namespace: 'test.*',
      name: 'Test Plugin',
    };
    expect(validatePlugin(plugin).valid).toBe(true);
  });

  it('validates plugin with entry renderer', () => {
    const plugin: ViewerPlugin = {
      namespace: 'test.*',
      name: 'Test Plugin',
      renderEntry: (entry, ctx) => ({
        html: '<div>test</div>',
        entryId: entry.id,
        type: entry.type,
      }),
    };
    expect(validatePlugin(plugin).valid).toBe(true);
  });

  it('validates plugin with aggregations', () => {
    const plugin: ViewerPlugin = {
      namespace: 'warmhub.*',
      name: 'WarmHub Plugin',
      aggregations: [
        {
          name: 'beliefTrajectory',
          types: ['warmhub.belief.query', 'warmhub.belief.update'],
          render: (entries, ctx) => '<div>trajectory</div>',
        },
      ],
    };
    expect(validatePlugin(plugin).valid).toBe(true);
    expect(plugin.aggregations?.[0].types).toContain('warmhub.belief.query');
  });

  it('rejects plugin without namespace', () => {
    const plugin = { name: 'Bad Plugin' } as ViewerPlugin;
    expect(validatePlugin(plugin).valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/plugin.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the plugin interface**

```typescript
// src/viewer/plugin.ts
import type { AEFEntry } from '../types.js';
import type { RenderContext, RenderedEntry } from './types.js';

/**
 * Aggregation view configuration
 * Aggregations combine multiple entries into a single visualization
 */
export interface PluginAggregation {
  /** Display name for the aggregation */
  name: string;
  /** Entry types this aggregation consumes */
  types: string[];
  /** Render function for the aggregated view */
  render: (entries: AEFEntry[], ctx: RenderContext) => string;
  /** Optional: position in document (header, footer, inline) */
  position?: 'header' | 'footer' | 'inline';
}

/**
 * Viewer plugin interface
 * Plugins extend the viewer with domain-specific visualizations
 */
export interface ViewerPlugin {
  /** Namespace pattern this plugin handles (e.g., 'warmhub.*') */
  readonly namespace: string;
  /** Display name */
  readonly name: string;
  /** Optional description */
  readonly description?: string;
  /** Version string */
  readonly version?: string;

  /**
   * Render a single entry
   * Return null to use default extension rendering
   */
  renderEntry?: (entry: AEFEntry, ctx: RenderContext) => RenderedEntry | null;

  /**
   * Aggregation views that span multiple entries
   */
  aggregations?: PluginAggregation[];

  /**
   * Additional CSS to inject
   */
  styles?: string;

  /**
   * Additional JavaScript to inject
   */
  scripts?: string;

  /**
   * Called once when plugin is registered
   */
  initialize?: () => void | Promise<void>;
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a plugin definition
 */
export function validatePlugin(plugin: ViewerPlugin): PluginValidationResult {
  const errors: string[] = [];

  if (!plugin.namespace) {
    errors.push('Plugin must have a namespace');
  } else if (!plugin.namespace.includes('*') && !plugin.namespace.includes('.')) {
    errors.push('Namespace must be a pattern (e.g., "vendor.*" or "vendor.category.*")');
  }

  if (!plugin.name) {
    errors.push('Plugin must have a name');
  }

  if (plugin.aggregations) {
    for (const agg of plugin.aggregations) {
      if (!agg.name) errors.push('Aggregation must have a name');
      if (!agg.types || agg.types.length === 0) {
        errors.push(`Aggregation "${agg.name}" must specify types`);
      }
      if (!agg.render) {
        errors.push(`Aggregation "${agg.name}" must have a render function`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if an entry type matches a namespace pattern
 */
export function matchesNamespace(entryType: string, namespace: string): boolean {
  // Convert glob pattern to regex
  const pattern = namespace
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(entryType);
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/viewer/plugin.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/plugin.ts src/__tests__/viewer/plugin.test.ts
git commit -m "feat(viewer): add plugin interface definition"
```

---

### Task 9: Plugin Registry

**Files:**
- Create: `src/viewer/registry.ts`
- Test: `src/__tests__/viewer/registry.test.ts`

**Step 1: Write failing test**

```typescript
// src/__tests__/viewer/registry.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { PluginRegistry } from '../../viewer/registry.js';
import type { ViewerPlugin } from '../../viewer/plugin.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('registers a plugin', () => {
    const plugin: ViewerPlugin = {
      namespace: 'test.*',
      name: 'Test Plugin',
    };
    registry.register(plugin);
    expect(registry.getPlugins()).toHaveLength(1);
  });

  it('finds plugin for entry type', () => {
    const plugin: ViewerPlugin = {
      namespace: 'warmhub.*',
      name: 'WarmHub Plugin',
    };
    registry.register(plugin);

    const found = registry.findPlugin('warmhub.belief.query');
    expect(found?.name).toBe('WarmHub Plugin');
  });

  it('returns null for unmatched entry type', () => {
    const plugin: ViewerPlugin = {
      namespace: 'warmhub.*',
      name: 'WarmHub Plugin',
    };
    registry.register(plugin);

    const found = registry.findPlugin('other.custom.type');
    expect(found).toBeNull();
  });

  it('prioritizes more specific namespaces', () => {
    const general: ViewerPlugin = {
      namespace: 'warmhub.*',
      name: 'General WarmHub',
    };
    const specific: ViewerPlugin = {
      namespace: 'warmhub.belief.*',
      name: 'Specific Belief',
    };
    registry.register(general);
    registry.register(specific);

    const found = registry.findPlugin('warmhub.belief.query');
    expect(found?.name).toBe('Specific Belief');
  });

  it('rejects invalid plugins', () => {
    const invalid = { name: 'No Namespace' } as ViewerPlugin;
    expect(() => registry.register(invalid)).toThrow();
  });

  it('collects all aggregations', () => {
    const plugin: ViewerPlugin = {
      namespace: 'warmhub.*',
      name: 'WarmHub',
      aggregations: [
        { name: 'trajectory', types: ['warmhub.belief.query'], render: () => '' },
      ],
    };
    registry.register(plugin);

    const aggs = registry.getAggregations();
    expect(aggs).toHaveLength(1);
    expect(aggs[0].name).toBe('trajectory');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/registry.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the registry**

```typescript
// src/viewer/registry.ts
import type { ViewerPlugin, PluginAggregation } from './plugin.js';
import { validatePlugin, matchesNamespace } from './plugin.js';

/**
 * Plugin registry for managing viewer extensions
 */
export class PluginRegistry {
  private plugins: ViewerPlugin[] = [];

  /**
   * Register a plugin
   * @throws Error if plugin is invalid
   */
  register(plugin: ViewerPlugin): void {
    const validation = validatePlugin(plugin);
    if (!validation.valid) {
      throw new Error(`Invalid plugin: ${validation.errors.join(', ')}`);
    }
    this.plugins.push(plugin);
    // Sort by specificity (more dots = more specific)
    this.plugins.sort((a, b) => {
      const dotsA = (a.namespace.match(/\./g) || []).length;
      const dotsB = (b.namespace.match(/\./g) || []).length;
      return dotsB - dotsA; // More specific first
    });
  }

  /**
   * Find the best matching plugin for an entry type
   */
  findPlugin(entryType: string): ViewerPlugin | null {
    for (const plugin of this.plugins) {
      if (matchesNamespace(entryType, plugin.namespace)) {
        return plugin;
      }
    }
    return null;
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): ViewerPlugin[] {
    return [...this.plugins];
  }

  /**
   * Collect all aggregations from all plugins
   */
  getAggregations(): Array<PluginAggregation & { pluginName: string }> {
    const result: Array<PluginAggregation & { pluginName: string }> = [];
    for (const plugin of this.plugins) {
      if (plugin.aggregations) {
        for (const agg of plugin.aggregations) {
          result.push({ ...agg, pluginName: plugin.name });
        }
      }
    }
    return result;
  }

  /**
   * Collect all plugin styles
   */
  getStyles(): string {
    return this.plugins
      .filter((p) => p.styles)
      .map((p) => `/* ${p.name} */\n${p.styles}`)
      .join('\n\n');
  }

  /**
   * Collect all plugin scripts
   */
  getScripts(): string {
    return this.plugins
      .filter((p) => p.scripts)
      .map((p) => `// ${p.name}\n${p.scripts}`)
      .join('\n\n');
  }

  /**
   * Initialize all plugins
   */
  async initialize(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.initialize) {
        await plugin.initialize();
      }
    }
  }
}

/**
 * Global default registry instance
 */
export const defaultRegistry = new PluginRegistry();
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/viewer/registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/registry.ts src/__tests__/viewer/registry.test.ts
git commit -m "feat(viewer): add plugin registry with namespace matching"
```

---

### Task 10: Integrate Plugins into HTML Generator

**Files:**
- Modify: `src/viewer/html.ts`
- Update: `src/__tests__/viewer/html.test.ts`

**Step 1: Add failing test for plugin integration**

Add to `src/__tests__/viewer/html.test.ts`:

```typescript
import { PluginRegistry } from '../../viewer/registry.js';
import type { ViewerPlugin } from '../../viewer/plugin.js';

describe('generateHtml with plugins', () => {
  it('uses plugin renderer for matching entries', () => {
    const registry = new PluginRegistry();
    const plugin: ViewerPlugin = {
      namespace: 'custom.*',
      name: 'Custom Plugin',
      renderEntry: (entry, ctx) => ({
        html: '<div class="custom-rendered">Custom!</div>',
        entryId: entry.id,
        type: entry.type,
      }),
    };
    registry.register(plugin);

    const entries: AEFEntry[] = [
      {
        v: 1,
        id: 'ext-1',
        ts: 1704067200000,
        type: 'custom.widget.foo',
        sid: 'test-session',
      },
    ];

    const html = generateHtml(entries, {}, registry);
    expect(html).toContain('custom-rendered');
    expect(html).toContain('Custom!');
  });

  it('includes plugin styles', () => {
    const registry = new PluginRegistry();
    registry.register({
      namespace: 'styled.*',
      name: 'Styled Plugin',
      styles: '.custom-style { color: red; }',
    });

    const entries: AEFEntry[] = [
      { v: 1, id: 's1', ts: 1704067200000, type: 'session.start', sid: 'test', agent: 'test' } as SessionStart,
    ];

    const html = generateHtml(entries, {}, registry);
    expect(html).toContain('.custom-style');
  });

  it('renders aggregations', () => {
    const registry = new PluginRegistry();
    registry.register({
      namespace: 'agg.*',
      name: 'Aggregation Plugin',
      aggregations: [
        {
          name: 'summary',
          types: ['agg.item'],
          position: 'footer',
          render: (entries) => `<div class="agg-summary">Count: ${entries.length}</div>`,
        },
      ],
    });

    const entries: AEFEntry[] = [
      { v: 1, id: 's1', ts: 1704067200000, type: 'session.start', sid: 'test', agent: 'test' } as SessionStart,
      { v: 1, id: 'a1', ts: 1704067201000, type: 'agg.item', sid: 'test' },
      { v: 1, id: 'a2', ts: 1704067202000, type: 'agg.item', sid: 'test' },
    ];

    const html = generateHtml(entries, {}, registry);
    expect(html).toContain('agg-summary');
    expect(html).toContain('Count: 2');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/viewer/html.test.ts`
Expected: FAIL (generateHtml doesn't accept registry parameter yet)

**Step 3: Update HTML generator to support plugins**

Update `src/viewer/html.ts`:

```typescript
// Add import
import { PluginRegistry, defaultRegistry } from './registry.js';

// Update function signature
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

  // Render aggregations
  const aggregationHtml = renderAggregations(entries, registry, opts);

  // Collect plugin styles and scripts
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

function isCoreType(type: string): boolean {
  return ['session.start', 'session.end', 'message', 'tool.call', 'tool.result', 'error'].includes(type);
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
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/viewer/html.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/viewer/html.ts src/__tests__/viewer/html.test.ts
git commit -m "feat(viewer): integrate plugin system into HTML generator"
```

---

### Task 11: Update Viewer Exports

**Files:**
- Modify: `src/viewer/index.ts`

**Step 1: Update exports**

```typescript
// src/viewer/index.ts
export { generateHtml } from './html.js';
export type { ViewerOptions, RenderContext, RenderedEntry, EntryRenderer } from './types.js';
export { getCoreStyles, getThemeVariables } from './styles.js';
export * from './renderers/index.js';
export * from './utils.js';

// Plugin system
export type { ViewerPlugin, PluginAggregation, PluginValidationResult } from './plugin.js';
export { validatePlugin, matchesNamespace } from './plugin.js';
export { PluginRegistry, defaultRegistry } from './registry.js';
```

**Step 2: Commit**

```bash
git add src/viewer/index.ts
git commit -m "feat(viewer): export plugin system from viewer module"
```

---

### Task 12: CLI Plugin Support

**Files:**
- Modify: `src/cli.ts`
- Test: `src/__tests__/cli-view.test.ts`

**Step 1: Add test for plugin loading**

Add to `src/__tests__/cli-view.test.ts`:

```typescript
describe('alf view with plugins', () => {
  it('loads plugin from file path', async () => {
    // Create a test plugin file
    const pluginFile = join(tmpDir, 'test-plugin.ts');
    await writeFile(pluginFile, `
      export default {
        namespace: 'test.*',
        name: 'Test Plugin',
        styles: '.test-plugin-loaded { display: block; }',
      };
    `);

    const result = await $`bun src/cli.ts view ${testFile} --plugin ${pluginFile}`.quiet();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('test-plugin-loaded');
  });
});
```

**Step 2: Update CLI to support plugins**

Update the view command in `src/cli.ts`:

```typescript
import { PluginRegistry } from './viewer/registry.js';
import type { ViewerPlugin } from './viewer/plugin.js';

program
  .command('view <file>')
  .description('Generate HTML viewer for an AEF JSONL file')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('--theme <theme>', 'Color theme (light, dark)', 'light')
  .option('--collapsed', 'Collapse tool results by default')
  .option('--plugin <path...>', 'Plugin file(s) to load')
  .action(async (file: string, options: { output?: string; theme: string; collapsed?: boolean; plugin?: string[] }) => {
    // Create registry and load plugins
    const registry = new PluginRegistry();

    if (options.plugin) {
      for (const pluginPath of options.plugin) {
        try {
          const module = await import(pluginPath);
          const plugin: ViewerPlugin = module.default || module;
          registry.register(plugin);
          console.error(`Loaded plugin: ${plugin.name}`);
        } catch (err) {
          console.error(`Failed to load plugin ${pluginPath}:`, err);
          process.exit(1);
        }
      }
    }

    const fileHandle = Bun.file(file);
    const text = await fileHandle.text();
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    const entries: AEFEntry[] = lines.map((line) => JSON.parse(line) as AEFEntry);

    const viewerOptions: ViewerOptions = {
      theme: options.theme as 'light' | 'dark',
      collapsedTools: options.collapsed ?? false,
    };

    const html = generateHtml(entries, viewerOptions, registry);

    if (options.output) {
      await Bun.write(options.output, html);
      console.error(`Wrote HTML viewer to ${options.output}`);
    } else {
      console.log(html);
    }
  });
```

**Step 3: Run tests to verify they pass**

Run: `bun test src/__tests__/cli-view.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/cli.ts src/__tests__/cli-view.test.ts
git commit -m "feat(cli): add plugin loading support to view command"
```

---

## Summary

### Phase 1 Deliverables
- `src/viewer/types.ts` - Core viewer interfaces
- `src/viewer/utils.ts` - HTML utilities (escape, format)
- `src/viewer/styles.ts` - CSS with theme support
- `src/viewer/renderers/` - Renderers for all 6 core AEF types
- `src/viewer/html.ts` - HTML document generator
- `src/cli.ts` - `alf view` command

### Phase 2 Deliverables
- `src/viewer/plugin.ts` - Plugin interface and validation
- `src/viewer/registry.ts` - Plugin registration and lookup
- Updated `src/viewer/html.ts` - Plugin integration
- Updated `src/cli.ts` - Plugin loading via `--plugin` flag

### Verification Commands

```bash
# Run all viewer tests
bun test src/__tests__/viewer/

# Generate HTML from AEF file
bun aef view sample.aef.jsonl -o output.html

# Generate with dark theme
bun aef view sample.aef.jsonl --theme dark -o dark.html

# Load custom plugin
bun aef view sample.aef.jsonl --plugin ./my-plugin.ts -o custom.html
```

### Next Steps (Phase 3+)
- Create `src/viewer/plugins/warmhub.ts` - Built-in WarmHub plugin
- Migrate belief visualization from ReActPOC
- Add waterfall timeline component
- Add sparkline SVG generator
