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
