// src/__tests__/viewer/styles.test.ts
import { describe, it, expect } from 'bun:test';
import { getCoreStyles, getThemeVariables } from '../../viewer/styles.js';

describe('getCoreStyles', () => {
  it('returns CSS string with root variables', () => {
    const css = getCoreStyles('light');
    expect(css).toContain(':root');
    expect(css).toContain('--aef-bg');
  });

  it('includes component styles', () => {
    const css = getCoreStyles('light');
    expect(css).toContain('.aef-entry');
    expect(css).toContain('.aef-message');
    expect(css).toContain('.aef-tool-call');
  });
});

describe('getThemeVariables', () => {
  it('returns light theme variables', () => {
    const vars = getThemeVariables('light');
    expect(vars['--aef-bg']).toBe('#ffffff');
  });

  it('returns dark theme variables', () => {
    const vars = getThemeVariables('dark');
    expect(vars['--aef-bg']).toBe('#1e1e1e');
  });
});
