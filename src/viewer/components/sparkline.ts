// src/viewer/components/sparkline.ts

/**
 * Sparkline SVG Generator
 *
 * Creates inline SVG sparklines for displaying time-series data.
 * Supports line charts, area charts, and bar charts.
 */

export interface SparklineOptions {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Stroke color for line */
  strokeColor?: string;
  /** Fill color for area (if filled) */
  fillColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to fill under the line */
  filled?: boolean;
  /** Show dots at data points */
  showDots?: boolean;
  /** Dot radius */
  dotRadius?: number;
  /** Min value for Y axis (defaults to min in data) */
  minY?: number;
  /** Max value for Y axis (defaults to max in data) */
  maxY?: number;
  /** CSS class to add to SVG */
  cssClass?: string;
}

export interface SparklineDataPoint {
  value: number;
  label?: string;
  color?: string;
}

const DEFAULT_OPTIONS: SparklineOptions = {
  width: 100,
  height: 24,
  strokeColor: '#3b82f6',
  fillColor: 'rgba(59, 130, 246, 0.2)',
  strokeWidth: 1.5,
  filled: false,
  showDots: false,
  dotRadius: 2,
};

/**
 * Generate an SVG sparkline from data points
 */
export function generateSparkline(
  data: number[] | SparklineDataPoint[],
  options: SparklineOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, strokeColor, fillColor, strokeWidth, filled, showDots, dotRadius, cssClass } = opts;

  if (!data || data.length === 0) {
    return `<svg width="${width}" height="${height}" class="${cssClass ?? ''}"></svg>`;
  }

  // Normalize data to numbers
  const values = data.map((d) => (typeof d === 'number' ? d : d.value));
  const colors = data.map((d) => (typeof d === 'number' ? null : d.color));

  // Calculate Y range
  const minY = opts.minY ?? Math.min(...values);
  const maxY = opts.maxY ?? Math.max(...values);
  const rangeY = maxY - minY || 1;

  // Padding to prevent clipping
  const padding = (strokeWidth ?? 1.5) + (showDots ? (dotRadius ?? 2) : 0);
  const effectiveHeight = (height ?? 24) - padding * 2;
  const effectiveWidth = (width ?? 100) - padding * 2;

  // Calculate points
  const points: Array<{ x: number; y: number; color?: string | null }> = values.map((v, i) => ({
    x: padding + (i / Math.max(values.length - 1, 1)) * effectiveWidth,
    y: padding + effectiveHeight - ((v - minY) / rangeY) * effectiveHeight,
    color: colors[i],
  }));

  // Build path
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Build fill path (closes to bottom)
  const fillPath = filled
    ? `${pathData} L ${points[points.length - 1].x.toFixed(1)} ${(height ?? 24) - padding} L ${padding} ${(height ?? 24) - padding} Z`
    : '';

  // Build dots
  const dots = showDots
    ? points
        .map(
          (p) =>
            `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dotRadius}" fill="${p.color ?? strokeColor}" />`
        )
        .join('')
    : '';

  return `<svg width="${width}" height="${height}" class="aef-sparkline ${cssClass ?? ''}" viewBox="0 0 ${width} ${height}">
  ${filled ? `<path d="${fillPath}" fill="${fillColor}" stroke="none" />` : ''}
  <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />
  ${dots}
</svg>`;
}

/**
 * Generate a multi-line sparkline with multiple series
 */
export function generateMultiSparkline(
  series: Array<{ data: number[]; color: string; label?: string }>,
  options: SparklineOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, strokeWidth, cssClass } = opts;

  if (!series || series.length === 0) {
    return `<svg width="${width}" height="${height}" class="${cssClass ?? ''}"></svg>`;
  }

  // Find global Y range across all series
  const allValues = series.flatMap((s) => s.data);
  const minY = opts.minY ?? Math.min(...allValues);
  const maxY = opts.maxY ?? Math.max(...allValues);
  const rangeY = maxY - minY || 1;

  const padding = (strokeWidth ?? 1.5) + (opts.showDots ? (opts.dotRadius ?? 2) : 0);
  const effectiveHeight = (height ?? 24) - padding * 2;
  const effectiveWidth = (width ?? 100) - padding * 2;

  const paths = series.map((s) => {
    const points = s.data.map((v, i) => ({
      x: padding + (i / Math.max(s.data.length - 1, 1)) * effectiveWidth,
      y: padding + effectiveHeight - ((v - minY) / rangeY) * effectiveHeight,
    }));

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    return `<path d="${pathData}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
  });

  return `<svg width="${width}" height="${height}" class="aef-sparkline aef-sparkline-multi ${cssClass ?? ''}" viewBox="0 0 ${width} ${height}">
  ${paths.join('\n  ')}
</svg>`;
}

/**
 * Generate a bar sparkline
 */
export function generateBarSparkline(
  data: number[] | SparklineDataPoint[],
  options: SparklineOptions & { barGap?: number; barColor?: string; negativeColor?: string } = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, barGap: 1, barColor: '#3b82f6', negativeColor: '#ef4444', ...options };
  const { width, height, barGap, barColor, negativeColor, cssClass } = opts;

  if (!data || data.length === 0) {
    return `<svg width="${width}" height="${height}" class="${cssClass ?? ''}"></svg>`;
  }

  const values = data.map((d) => (typeof d === 'number' ? d : d.value));
  const colors = data.map((d) => (typeof d === 'number' ? null : d.color));

  const minY = opts.minY ?? Math.min(0, ...values);
  const maxY = opts.maxY ?? Math.max(0, ...values);
  const rangeY = maxY - minY || 1;

  const padding = 2;
  const effectiveHeight = (height ?? 24) - padding * 2;
  const effectiveWidth = (width ?? 100) - padding * 2;

  const barWidth = (effectiveWidth - (barGap ?? 1) * (values.length - 1)) / values.length;
  const zeroY = padding + effectiveHeight - ((0 - minY) / rangeY) * effectiveHeight;

  const bars = values.map((v, i) => {
    const x = padding + i * (barWidth + (barGap ?? 1));
    const barHeight = (Math.abs(v) / rangeY) * effectiveHeight;
    const y = v >= 0 ? zeroY - barHeight : zeroY;
    const color = colors[i] ?? (v >= 0 ? barColor : negativeColor);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="${color}" />`;
  });

  return `<svg width="${width}" height="${height}" class="aef-sparkline aef-sparkline-bar ${cssClass ?? ''}" viewBox="0 0 ${width} ${height}">
  ${bars.join('\n  ')}
</svg>`;
}

/**
 * Generate a belief state sparkline showing B/D/U values
 * This is a specialized sparkline for hypothesis belief trajectories
 */
export function generateBeliefSparkline(
  data: Array<{ b: number; d: number; u: number }>,
  options: SparklineOptions & { labelFinal?: boolean } = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, width: 120, height: 28, ...options };

  if (!data || data.length === 0) {
    return `<svg width="${opts.width}" height="${opts.height}"></svg>`;
  }

  const series = [
    { data: data.map((d) => d.b), color: '#22c55e', label: 'Belief' },
    { data: data.map((d) => d.d), color: '#ef4444', label: 'Disbelief' },
    { data: data.map((d) => d.u), color: '#a3a3a3', label: 'Uncertainty' },
  ];

  const sparkline = generateMultiSparkline(series, {
    ...opts,
    minY: 0,
    maxY: 1,
  });

  // Add final value labels if requested
  if (opts.labelFinal && data.length > 0) {
    const final = data[data.length - 1];
    const labels = `
      <text x="${(opts.width ?? 120) + 4}" y="10" font-size="9" fill="#22c55e">${(final.b * 100).toFixed(0)}%</text>
      <text x="${(opts.width ?? 120) + 4}" y="20" font-size="9" fill="#ef4444">${(final.d * 100).toFixed(0)}%</text>
      <text x="${(opts.width ?? 120) + 4}" y="30" font-size="9" fill="#a3a3a3">${(final.u * 100).toFixed(0)}%</text>
    `;
    // Return wider SVG with labels
    return sparkline.replace(
      `width="${opts.width}"`,
      `width="${(opts.width ?? 120) + 40}"`
    ).replace('</svg>', `${labels}</svg>`);
  }

  return sparkline;
}
