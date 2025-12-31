// src/__tests__/viewer/components/sparkline.test.ts

import { describe, it, expect } from 'bun:test';
import {
  generateSparkline,
  generateMultiSparkline,
  generateBarSparkline,
  generateBeliefSparkline,
} from '../../../viewer/components/sparkline.js';

describe('generateSparkline', () => {
  it('generates an SVG element', () => {
    const svg = generateSparkline([1, 2, 3, 4, 5]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('creates path element with data', () => {
    const svg = generateSparkline([0, 1, 0.5]);
    expect(svg).toContain('<path');
    expect(svg).toContain('d="M');
  });

  it('respects width and height options', () => {
    const svg = generateSparkline([1, 2, 3], { width: 200, height: 50 });
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="50"');
  });

  it('applies custom stroke color', () => {
    const svg = generateSparkline([1, 2, 3], { strokeColor: '#ff0000' });
    expect(svg).toContain('stroke="#ff0000"');
  });

  it('handles empty data', () => {
    const svg = generateSparkline([]);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<path');
  });

  it('handles single data point', () => {
    const svg = generateSparkline([5]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
  });

  it('adds fill when filled option is true', () => {
    const svg = generateSparkline([1, 2, 3], { filled: true });
    expect(svg).toContain('fill="rgba');
  });

  it('shows dots when showDots is true', () => {
    const svg = generateSparkline([1, 2, 3], { showDots: true });
    expect(svg).toContain('<circle');
  });

  it('handles data point objects', () => {
    const svg = generateSparkline([
      { value: 1, label: 'a' },
      { value: 2, label: 'b' },
      { value: 3, label: 'c' },
    ]);
    expect(svg).toContain('<path');
  });

  it('applies custom CSS class', () => {
    const svg = generateSparkline([1, 2, 3], { cssClass: 'my-sparkline' });
    expect(svg).toContain('class="aef-sparkline my-sparkline"');
  });
});

describe('generateMultiSparkline', () => {
  it('generates multiple paths for each series', () => {
    const svg = generateMultiSparkline([
      { data: [1, 2, 3], color: '#ff0000' },
      { data: [3, 2, 1], color: '#00ff00' },
    ]);
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).toContain('stroke="#00ff00"');
  });

  it('handles empty series', () => {
    const svg = generateMultiSparkline([]);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<path');
  });

  it('uses shared Y scale across series', () => {
    const svg = generateMultiSparkline([
      { data: [0, 1], color: '#ff0000' },
      { data: [0.5, 0.5], color: '#00ff00' },
    ]);
    // Both paths should exist with proper scaling
    expect((svg.match(/<path/g) || []).length).toBe(2);
  });
});

describe('generateBarSparkline', () => {
  it('generates rect elements for bars', () => {
    const svg = generateBarSparkline([1, 2, 3, 4]);
    expect(svg).toContain('<rect');
  });

  it('handles negative values with different color', () => {
    const svg = generateBarSparkline([-1, 2, -3, 4], {
      barColor: '#0000ff',
      negativeColor: '#ff0000',
    });
    expect(svg).toContain('#0000ff');
    expect(svg).toContain('#ff0000');
  });

  it('handles empty data', () => {
    const svg = generateBarSparkline([]);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<rect');
  });
});

describe('generateBeliefSparkline', () => {
  it('generates belief/disbelief/uncertainty lines', () => {
    const svg = generateBeliefSparkline([
      { b: 0.5, d: 0.2, u: 0.3 },
      { b: 0.7, d: 0.1, u: 0.2 },
    ]);
    // Should have 3 paths (B, D, U)
    expect((svg.match(/<path/g) || []).length).toBe(3);
    // Should use correct colors
    expect(svg).toContain('#22c55e'); // Belief green
    expect(svg).toContain('#ef4444'); // Disbelief red
    expect(svg).toContain('#a3a3a3'); // Uncertainty gray
  });

  it('handles empty data', () => {
    const svg = generateBeliefSparkline([]);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<path');
  });

  it('adds labels when labelFinal is true', () => {
    const svg = generateBeliefSparkline(
      [{ b: 0.8, d: 0.1, u: 0.1 }],
      { labelFinal: true }
    );
    expect(svg).toContain('80%');
    expect(svg).toContain('10%');
  });
});
