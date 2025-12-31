// examples/warmhub-viewer/plugin.ts

/**
 * WarmHub Viewer Plugin
 *
 * Provides specialized visualization for WarmHub-specific AEF extensions:
 * - warmhub.belief.query - Belief state queries with hypothesis snapshots
 * - warmhub.belief.update - Belief state updates from assertions
 * - warmhub.react.step - ReAct agent reasoning steps
 * - warmhub.react.episode - Episode-level summaries
 */

import type { AEFEntry } from '../../src/types.js';
import type { ViewerPlugin, PluginAggregation } from '../../src/viewer/plugin.js';
import type { RenderContext, RenderedEntry } from '../../src/viewer/types.js';
import { escapeHtml, formatDuration, formatTimestamp } from '../../src/viewer/utils.js';
import { generateBeliefSparkline, generateMultiSparkline } from '../../src/viewer/components/sparkline.js';
import { generateCompactWaterfall, type WaterfallItem } from '../../src/viewer/components/waterfall.js';

// =============================================================================
// WarmHub Extension Types
// =============================================================================

interface Hypothesis {
  id: string;
  desc: string;
  b: number;
  d: number;
  u: number;
}

interface BeliefSnapshot {
  hypotheses: Hypothesis[];
  assertions: number;
  finish_ready: boolean;
  leading?: string;
}

interface BeliefQueryEntry extends AEFEntry {
  type: 'warmhub.belief.query';
  query: string;
  snapshot: BeliefSnapshot;
}

interface BeliefUpdateEntry extends AEFEntry {
  type: 'warmhub.belief.update';
  assertion: {
    id: string;
    type: string;
    content?: string;
    consistent_with?: string[];
    inconsistent_with?: string[];
  };
  snapshot_after?: BeliefSnapshot;
}

interface ReactStepEntry extends AEFEntry {
  type: 'warmhub.react.step';
  step: number;
  thought?: string;
  action: string;
  action_arg?: string;
  observation?: string;
  latency_ms?: number;
  tokens?: { input: number; output: number };
}

interface ReactEpisodeEntry extends AEFEntry {
  type: 'warmhub.react.episode';
  question_id: string;
  question: string;
  gold_answer: string;
  predicted_answer?: string | null;
  status: string;
  metrics: {
    em: number;
    f1: number;
    tool_calls: number;
    total_latency_ms: number;
    total_tokens: number;
  };
  belief_metrics?: {
    hypothesis_reversals: number;
    final_confidence: number;
    uncertainty_reduction: number;
    finish_gate_respected: boolean;
  };
}

// =============================================================================
// Entry Renderers
// =============================================================================

function renderBeliefQuery(entry: BeliefQueryEntry, ctx: RenderContext): RenderedEntry {
  const { snapshot } = entry;
  const leading = snapshot.hypotheses.find((h) => h.id === snapshot.leading);

  const hypothesesHtml = snapshot.hypotheses
    .map((h) => {
      const isLeading = h.id === snapshot.leading;
      const confidence = h.b - h.d;
      const barWidth = Math.abs(confidence) * 50;
      const barColor = confidence >= 0 ? '#22c55e' : '#ef4444';
      const barLeft = confidence >= 0 ? 50 : 50 - barWidth;

      return `
        <div class="warmhub-hypothesis ${isLeading ? 'warmhub-hypothesis-leading' : ''}">
          <div class="warmhub-hypothesis-header">
            <span class="warmhub-hypothesis-id">${escapeHtml(h.id)}</span>
            ${isLeading ? '<span class="warmhub-badge warmhub-badge-leading">Leading</span>' : ''}
          </div>
          <div class="warmhub-hypothesis-desc">${escapeHtml(h.desc)}</div>
          <div class="warmhub-hypothesis-bars">
            <div class="warmhub-hypothesis-bar-bg">
              <div class="warmhub-hypothesis-bar" style="left: ${barLeft}%; width: ${barWidth}%; background: ${barColor};"></div>
              <div class="warmhub-hypothesis-bar-center"></div>
            </div>
          </div>
          <div class="warmhub-hypothesis-values">
            <span class="warmhub-bdu warmhub-b">B: ${(h.b * 100).toFixed(0)}%</span>
            <span class="warmhub-bdu warmhub-d">D: ${(h.d * 100).toFixed(0)}%</span>
            <span class="warmhub-bdu warmhub-u">U: ${(h.u * 100).toFixed(0)}%</span>
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
    <div class="aef-entry-header">
      <span class="aef-badge warmhub-badge-belief">belief query</span>
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    <div class="warmhub-belief-query">
      <div class="warmhub-query-text">${escapeHtml(entry.query)}</div>
      <div class="warmhub-snapshot-meta">
        <span>Assertions: ${snapshot.assertions}</span>
        <span class="${snapshot.finish_ready ? 'warmhub-finish-ready' : 'warmhub-finish-not-ready'}">
          Finish: ${snapshot.finish_ready ? 'Ready' : 'Not Ready'}
        </span>
      </div>
      <div class="warmhub-hypotheses">${hypothesesHtml}</div>
    </div>
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['warmhub-belief', 'warmhub-belief-query'],
  };
}

function renderBeliefUpdate(entry: BeliefUpdateEntry, ctx: RenderContext): RenderedEntry {
  const { assertion } = entry;

  const consistencyHtml = [
    ...(assertion.consistent_with ?? []).map(
      (id) => `<span class="warmhub-consistency warmhub-consistent">+${escapeHtml(id)}</span>`
    ),
    ...(assertion.inconsistent_with ?? []).map(
      (id) => `<span class="warmhub-consistency warmhub-inconsistent">-${escapeHtml(id)}</span>`
    ),
  ].join('');

  const html = `
    <div class="aef-entry-header">
      <span class="aef-badge warmhub-badge-belief">belief update</span>
      <span class="warmhub-assertion-type">${escapeHtml(assertion.type)}</span>
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    <div class="warmhub-belief-update">
      <div class="warmhub-assertion-id">${escapeHtml(assertion.id)}</div>
      ${assertion.content ? `<div class="warmhub-assertion-content">${escapeHtml(assertion.content)}</div>` : ''}
      ${consistencyHtml ? `<div class="warmhub-consistency-list">${consistencyHtml}</div>` : ''}
    </div>
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['warmhub-belief', 'warmhub-belief-update'],
  };
}

function renderReactStep(entry: ReactStepEntry, ctx: RenderContext): RenderedEntry {
  const html = `
    <div class="aef-entry-header">
      <span class="aef-badge warmhub-badge-react">step ${entry.step}</span>
      <span class="warmhub-action">${escapeHtml(entry.action)}</span>
      ${entry.latency_ms ? `<span class="aef-duration">${formatDuration(entry.latency_ms)}</span>` : ''}
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    <div class="warmhub-react-step">
      ${entry.thought ? `<div class="warmhub-thought"><strong>Thought:</strong> ${escapeHtml(entry.thought)}</div>` : ''}
      <div class="warmhub-action-detail">
        <strong>Action:</strong> ${escapeHtml(entry.action)}${entry.action_arg ? `[${escapeHtml(entry.action_arg)}]` : ''}
      </div>
      ${entry.observation ? `
        <div class="warmhub-observation">
          <strong>Observation:</strong>
          <pre class="aef-code">${escapeHtml(entry.observation)}</pre>
        </div>
      ` : ''}
      ${entry.tokens ? `
        <div class="warmhub-tokens">
          Tokens: ${entry.tokens.input} in / ${entry.tokens.output} out
        </div>
      ` : ''}
    </div>
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['warmhub-react', 'warmhub-react-step'],
  };
}

function renderReactEpisode(entry: ReactEpisodeEntry, ctx: RenderContext): RenderedEntry {
  const { metrics, belief_metrics } = entry;
  const isCorrect = metrics.em === 1;

  const html = `
    <div class="aef-entry-header">
      <span class="aef-badge ${isCorrect ? 'warmhub-badge-success' : 'warmhub-badge-failure'}">
        ${entry.status}
      </span>
      <span>EM: ${(metrics.em * 100).toFixed(0)}% | F1: ${(metrics.f1 * 100).toFixed(0)}%</span>
      <span>${formatTimestamp(entry.ts)}</span>
    </div>
    <div class="warmhub-episode-summary">
      <div class="warmhub-qa-pair">
        <div class="warmhub-question">
          <strong>Q:</strong> ${escapeHtml(entry.question)}
        </div>
        <div class="warmhub-answers">
          <div class="warmhub-gold"><strong>Gold:</strong> ${escapeHtml(entry.gold_answer)}</div>
          <div class="warmhub-predicted ${isCorrect ? 'warmhub-correct' : 'warmhub-incorrect'}">
            <strong>Predicted:</strong> ${escapeHtml(entry.predicted_answer ?? '(none)')}
          </div>
        </div>
      </div>
      <div class="warmhub-metrics-grid">
        <div class="warmhub-metric">
          <div class="warmhub-metric-value">${metrics.tool_calls}</div>
          <div class="warmhub-metric-label">Tool Calls</div>
        </div>
        <div class="warmhub-metric">
          <div class="warmhub-metric-value">${formatDuration(metrics.total_latency_ms)}</div>
          <div class="warmhub-metric-label">Duration</div>
        </div>
        <div class="warmhub-metric">
          <div class="warmhub-metric-value">${metrics.total_tokens.toLocaleString()}</div>
          <div class="warmhub-metric-label">Tokens</div>
        </div>
        ${belief_metrics ? `
          <div class="warmhub-metric">
            <div class="warmhub-metric-value">${belief_metrics.hypothesis_reversals}</div>
            <div class="warmhub-metric-label">Reversals</div>
          </div>
          <div class="warmhub-metric">
            <div class="warmhub-metric-value">${(belief_metrics.final_confidence * 100).toFixed(0)}%</div>
            <div class="warmhub-metric-label">Confidence</div>
          </div>
          <div class="warmhub-metric">
            <div class="warmhub-metric-value ${belief_metrics.finish_gate_respected ? 'warmhub-success' : 'warmhub-warning'}">
              ${belief_metrics.finish_gate_respected ? 'Yes' : 'No'}
            </div>
            <div class="warmhub-metric-label">Gate OK</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  return {
    html,
    entryId: entry.id,
    type: entry.type,
    cssClasses: ['warmhub-react', 'warmhub-react-episode'],
  };
}

// =============================================================================
// Aggregations
// =============================================================================

/**
 * Extract belief trajectory from belief query entries
 */
function renderBeliefTrajectory(entries: AEFEntry[], ctx: RenderContext): string {
  const beliefQueries = entries.filter(
    (e): e is BeliefQueryEntry => e.type === 'warmhub.belief.query'
  );

  if (beliefQueries.length === 0) {
    return '<div class="warmhub-no-data">No belief queries found</div>';
  }

  // Get unique hypothesis IDs across all snapshots
  const allHypotheses = new Map<string, { desc: string; data: Array<{ b: number; d: number; u: number }> }>();

  for (const query of beliefQueries) {
    for (const h of query.snapshot.hypotheses) {
      if (!allHypotheses.has(h.id)) {
        allHypotheses.set(h.id, { desc: h.desc, data: [] });
      }
    }
  }

  // Fill in data for each hypothesis
  for (const query of beliefQueries) {
    const snapshotMap = new Map(query.snapshot.hypotheses.map((h) => [h.id, h]));
    for (const [id, { data }] of allHypotheses) {
      const h = snapshotMap.get(id);
      if (h) {
        data.push({ b: h.b, d: h.d, u: h.u });
      } else {
        // Hypothesis not in this snapshot, use last known value or zero
        const last = data[data.length - 1];
        data.push(last ?? { b: 0, d: 0, u: 1 });
      }
    }
  }

  // Render trajectory for each hypothesis
  const trajectoryHtml = Array.from(allHypotheses.entries())
    .map(([id, { desc, data }]) => {
      const sparkline = generateBeliefSparkline(data, { width: 150, height: 32, labelFinal: true });
      const finalB = data[data.length - 1]?.b ?? 0;
      const finalD = data[data.length - 1]?.d ?? 0;
      const confidence = finalB - finalD;

      return `
        <div class="warmhub-trajectory-row">
          <div class="warmhub-trajectory-id" title="${escapeHtml(desc)}">${escapeHtml(id)}</div>
          <div class="warmhub-trajectory-sparkline">${sparkline}</div>
          <div class="warmhub-trajectory-confidence ${confidence >= 0 ? 'warmhub-positive' : 'warmhub-negative'}">
            ${confidence >= 0 ? '+' : ''}${(confidence * 100).toFixed(0)}%
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="warmhub-belief-trajectory">
      <h3 class="warmhub-aggregation-title">Belief Trajectory</h3>
      <div class="warmhub-trajectory-legend">
        <span class="warmhub-legend-item"><span class="warmhub-legend-color" style="background: #22c55e"></span>Belief</span>
        <span class="warmhub-legend-item"><span class="warmhub-legend-color" style="background: #ef4444"></span>Disbelief</span>
        <span class="warmhub-legend-item"><span class="warmhub-legend-color" style="background: #a3a3a3"></span>Uncertainty</span>
      </div>
      <div class="warmhub-trajectory-grid">
        ${trajectoryHtml}
      </div>
    </div>
  `;
}

/**
 * Render tool call waterfall from react steps
 */
function renderToolWaterfall(entries: AEFEntry[], ctx: RenderContext): string {
  const reactSteps = entries.filter(
    (e): e is ReactStepEntry => e.type === 'warmhub.react.step'
  );

  if (reactSteps.length === 0) {
    return '';
  }

  const waterfallItems: WaterfallItem[] = reactSteps.map((step) => ({
    id: step.id,
    label: `Step ${step.step}: ${step.action}`,
    startMs: step.ts,
    durationMs: step.latency_ms ?? 100,
    category: step.action.toLowerCase().includes('search') || step.action.toLowerCase().includes('lookup')
      ? 'api'
      : step.action.toLowerCase().includes('belief')
        ? 'belief'
        : 'tool',
    success: true,
  }));

  const compactWaterfall = generateCompactWaterfall(waterfallItems, { width: 400, height: 24 });

  return `
    <div class="warmhub-tool-waterfall">
      <h3 class="warmhub-aggregation-title">Execution Timeline</h3>
      ${compactWaterfall}
      <div class="warmhub-waterfall-stats">
        <span>${reactSteps.length} steps</span>
        <span>${formatDuration(reactSteps.reduce((sum, s) => sum + (s.latency_ms ?? 0), 0))}</span>
      </div>
    </div>
  `;
}

// =============================================================================
// Plugin Styles
// =============================================================================

const warmhubStyles = `
/* WarmHub Plugin Styles */

/* Badges */
.warmhub-badge-belief { background: #10b981; color: white; }
.warmhub-badge-react { background: #8b5cf6; color: white; }
.warmhub-badge-success { background: #22c55e; color: white; }
.warmhub-badge-failure { background: #ef4444; color: white; }
.warmhub-badge-leading { background: #3b82f6; color: white; font-size: 10px; padding: 1px 6px; }

/* Belief Query */
.warmhub-belief-query {
  padding: 8px 0;
}

.warmhub-query-text {
  font-style: italic;
  color: var(--aef-muted);
  margin-bottom: 8px;
}

.warmhub-snapshot-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  margin-bottom: 12px;
}

.warmhub-finish-ready { color: #22c55e; font-weight: 600; }
.warmhub-finish-not-ready { color: #f59e0b; }

/* Hypotheses */
.warmhub-hypotheses {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warmhub-hypothesis {
  padding: 10px;
  border: 1px solid var(--aef-border);
  border-radius: 6px;
  background: var(--aef-bg);
}

.warmhub-hypothesis-leading {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.warmhub-hypothesis-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.warmhub-hypothesis-id {
  font-weight: 600;
  font-family: monospace;
}

.warmhub-hypothesis-desc {
  font-size: 13px;
  color: var(--aef-muted);
  margin-bottom: 8px;
}

.warmhub-hypothesis-bars {
  margin: 8px 0;
}

.warmhub-hypothesis-bar-bg {
  position: relative;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.warmhub-hypothesis-bar {
  position: absolute;
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s, left 0.3s;
}

.warmhub-hypothesis-bar-center {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #9ca3af;
  transform: translateX(-50%);
}

.warmhub-hypothesis-values {
  display: flex;
  gap: 12px;
  font-size: 11px;
  font-family: monospace;
}

.warmhub-bdu.warmhub-b { color: #22c55e; }
.warmhub-bdu.warmhub-d { color: #ef4444; }
.warmhub-bdu.warmhub-u { color: #6b7280; }

/* Belief Update */
.warmhub-belief-update {
  padding: 8px 0;
}

.warmhub-assertion-id {
  font-weight: 600;
  font-family: monospace;
  margin-bottom: 4px;
}

.warmhub-assertion-content {
  font-size: 13px;
  color: var(--aef-muted);
  margin-bottom: 8px;
}

.warmhub-consistency-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.warmhub-consistency {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-family: monospace;
}

.warmhub-consistent { background: #dcfce7; color: #166534; }
.warmhub-inconsistent { background: #fee2e2; color: #991b1b; }

/* React Step */
.warmhub-react-step {
  padding: 8px 0;
}

.warmhub-thought {
  padding: 8px 12px;
  background: var(--aef-code-bg);
  border-radius: 4px;
  margin-bottom: 8px;
  font-style: italic;
}

.warmhub-action-detail {
  margin-bottom: 8px;
}

.warmhub-observation {
  margin-top: 8px;
}

.warmhub-tokens {
  font-size: 12px;
  color: var(--aef-muted);
  margin-top: 8px;
}

/* Episode Summary */
.warmhub-episode-summary {
  padding: 8px 0;
}

.warmhub-qa-pair {
  margin-bottom: 16px;
}

.warmhub-question {
  margin-bottom: 8px;
}

.warmhub-answers {
  display: flex;
  gap: 16px;
}

.warmhub-gold, .warmhub-predicted {
  flex: 1;
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--aef-code-bg);
}

.warmhub-correct { border-left: 3px solid #22c55e; }
.warmhub-incorrect { border-left: 3px solid #ef4444; }

.warmhub-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.warmhub-metric {
  text-align: center;
  padding: 12px;
  background: var(--aef-code-bg);
  border-radius: 6px;
}

.warmhub-metric-value {
  font-size: 18px;
  font-weight: 600;
}

.warmhub-metric-label {
  font-size: 11px;
  color: var(--aef-muted);
  text-transform: uppercase;
}

.warmhub-success { color: #22c55e; }
.warmhub-warning { color: #f59e0b; }

/* Aggregations */
.warmhub-aggregation-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

/* Belief Trajectory */
.warmhub-belief-trajectory {
  padding: 16px;
  background: var(--aef-assistant-bg);
  border: 1px solid var(--aef-border);
  border-radius: 8px;
  margin-bottom: 16px;
}

.warmhub-trajectory-legend {
  display: flex;
  gap: 16px;
  font-size: 11px;
  margin-bottom: 12px;
}

.warmhub-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.warmhub-legend-color {
  width: 12px;
  height: 3px;
  border-radius: 2px;
}

.warmhub-trajectory-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warmhub-trajectory-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.warmhub-trajectory-id {
  width: 60px;
  font-family: monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.warmhub-trajectory-sparkline {
  flex: 1;
}

.warmhub-trajectory-confidence {
  width: 50px;
  text-align: right;
  font-weight: 600;
  font-size: 12px;
}

.warmhub-positive { color: #22c55e; }
.warmhub-negative { color: #ef4444; }

/* Tool Waterfall */
.warmhub-tool-waterfall {
  padding: 16px;
  background: var(--aef-assistant-bg);
  border: 1px solid var(--aef-border);
  border-radius: 8px;
  margin-bottom: 16px;
}

.warmhub-waterfall-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--aef-muted);
  margin-top: 8px;
}

.warmhub-no-data {
  color: var(--aef-muted);
  font-style: italic;
  text-align: center;
  padding: 24px;
}
`;

// =============================================================================
// Plugin Export
// =============================================================================

export const warmhubPlugin: ViewerPlugin = {
  namespace: 'warmhub.*',
  name: 'WarmHub Plugin',
  description: 'Visualization for WarmHub belief-conditioned agents',
  version: '0.1.0',

  renderEntry(entry: AEFEntry, ctx: RenderContext): RenderedEntry | null {
    switch (entry.type) {
      case 'warmhub.belief.query':
        return renderBeliefQuery(entry as BeliefQueryEntry, ctx);
      case 'warmhub.belief.update':
        return renderBeliefUpdate(entry as BeliefUpdateEntry, ctx);
      case 'warmhub.react.step':
        return renderReactStep(entry as ReactStepEntry, ctx);
      case 'warmhub.react.episode':
        return renderReactEpisode(entry as ReactEpisodeEntry, ctx);
      default:
        return null;
    }
  },

  aggregations: [
    {
      name: 'beliefTrajectory',
      types: ['warmhub.belief.query'],
      position: 'header',
      render: renderBeliefTrajectory,
    },
    {
      name: 'toolWaterfall',
      types: ['warmhub.react.step'],
      position: 'header',
      render: renderToolWaterfall,
    },
  ],

  styles: warmhubStyles,
};

export default warmhubPlugin;
