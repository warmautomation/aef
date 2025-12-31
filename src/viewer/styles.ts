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
