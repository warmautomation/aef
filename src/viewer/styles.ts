// src/viewer/styles.ts

export type Theme = 'light' | 'dark';

const LIGHT_THEME = {
  '--aef-bg': '#ffffff',
  '--aef-fg': '#1a1a1a',
  '--aef-border': '#e0e0e0',
  '--aef-muted': '#666666',
  '--aef-accent': '#0066cc',
  '--aef-success': '#22863a',
  '--aef-error': '#cb2431',
  '--aef-warning': '#b08800',
  '--aef-user-bg': '#f0f7ff',
  '--aef-assistant-bg': '#f6f8fa',
  '--aef-tool-bg': '#fffbeb',
  '--aef-error-bg': '#ffeef0',
  '--aef-code-bg': '#f6f8fa',
};

const DARK_THEME = {
  '--aef-bg': '#1e1e1e',
  '--aef-fg': '#e0e0e0',
  '--aef-border': '#404040',
  '--aef-muted': '#999999',
  '--aef-accent': '#58a6ff',
  '--aef-success': '#3fb950',
  '--aef-error': '#f85149',
  '--aef-warning': '#d29922',
  '--aef-user-bg': '#1c2d3d',
  '--aef-assistant-bg': '#2d2d2d',
  '--aef-tool-bg': '#3d3520',
  '--aef-error-bg': '#3d1f22',
  '--aef-code-bg': '#2d2d2d',
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
  color: var(--aef-fg);
  background: var(--aef-bg);
  margin: 0;
  padding: 20px;
}

.aef-container {
  max-width: 1200px;
  margin: 0 auto;
}

.aef-session-header {
  padding: 16px;
  border: 1px solid var(--aef-border);
  border-radius: 8px;
  margin-bottom: 16px;
  background: var(--aef-assistant-bg);
}

.aef-session-header h1 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.aef-entry {
  padding: 12px 16px;
  border: 1px solid var(--aef-border);
  border-radius: 6px;
  margin-bottom: 8px;
}

.aef-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--aef-muted);
}

.aef-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.aef-badge-user { background: var(--aef-accent); color: white; }
.aef-badge-assistant { background: var(--aef-success); color: white; }
.aef-badge-system { background: var(--aef-muted); color: white; }
.aef-badge-tool { background: var(--aef-warning); color: white; }
.aef-badge-error { background: var(--aef-error); color: white; }

.aef-message { background: var(--aef-assistant-bg); }
.aef-message-user { background: var(--aef-user-bg); }
.aef-message-assistant { background: var(--aef-assistant-bg); }

.aef-tool-call { background: var(--aef-tool-bg); }
.aef-tool-result { background: var(--aef-tool-bg); }
.aef-error { background: var(--aef-error-bg); }

.aef-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.aef-code {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  background: var(--aef-code-bg);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.aef-sequence {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 11px;
  color: var(--aef-muted);
  margin-left: 8px;
}

.aef-collapsible {
  cursor: pointer;
}

.aef-collapsible::after {
  content: ' ▶';
  font-size: 10px;
}

.aef-collapsible.expanded::after {
  content: ' ▼';
}

.aef-collapsible-content {
  display: none;
}

.aef-collapsible.expanded + .aef-collapsible-content,
.aef-collapsible.expanded ~ .aef-collapsible-content {
  display: block;
}

.aef-tool-name {
  font-weight: 600;
  color: var(--aef-accent);
}

.aef-duration {
  color: var(--aef-muted);
  font-size: 12px;
}

.aef-success { color: var(--aef-success); }
.aef-failure { color: var(--aef-error); }
`;
}
