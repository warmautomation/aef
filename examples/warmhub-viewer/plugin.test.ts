// examples/warmhub-viewer/plugin.test.ts

import { describe, it, expect } from 'bun:test';
import { warmhubPlugin } from './plugin.js';
import type { AEFEntry } from '../../src/types.js';
import type { RenderContext } from '../../src/viewer/types.js';

const baseCtx: RenderContext = {
  sessionId: 'test-session',
  entryIndex: 0,
  totalEntries: 10,
  options: { theme: 'light' },
};

describe('warmhubPlugin', () => {
  it('has correct namespace', () => {
    expect(warmhubPlugin.namespace).toBe('warmhub.*');
  });

  it('has a name', () => {
    expect(warmhubPlugin.name).toBe('WarmHub Plugin');
  });

  it('provides styles', () => {
    expect(warmhubPlugin.styles).toContain('.warmhub-belief');
    expect(warmhubPlugin.styles).toContain('.warmhub-hypothesis');
  });

  it('has aggregations defined', () => {
    expect(warmhubPlugin.aggregations).toBeDefined();
    expect(warmhubPlugin.aggregations?.length).toBeGreaterThan(0);
  });
});

describe('warmhubPlugin.renderEntry', () => {
  it('renders warmhub.belief.query entries', () => {
    const entry: AEFEntry & { query: string; snapshot: unknown } = {
      v: 1,
      id: 'bq-1',
      ts: 1704067200000,
      type: 'warmhub.belief.query',
      sid: 'test-session',
      query: 'What is the answer?',
      snapshot: {
        hypotheses: [
          { id: 'H1', desc: 'First hypothesis', b: 0.6, d: 0.1, u: 0.3 },
          { id: 'H2', desc: 'Second hypothesis', b: 0.3, d: 0.4, u: 0.3 },
        ],
        assertions: 5,
        finish_ready: false,
        leading: 'H1',
      },
    };

    const result = warmhubPlugin.renderEntry!(entry, baseCtx);
    expect(result).not.toBeNull();
    expect(result?.html).toContain('belief query');
    expect(result?.html).toContain('What is the answer?');
    expect(result?.html).toContain('H1');
    expect(result?.html).toContain('First hypothesis');
    expect(result?.html).toContain('60%'); // B value
    expect(result?.html).toContain('Leading');
    expect(result?.cssClasses).toContain('warmhub-belief-query');
  });

  it('renders warmhub.belief.update entries', () => {
    const entry: AEFEntry & { assertion: unknown } = {
      v: 1,
      id: 'bu-1',
      ts: 1704067200000,
      type: 'warmhub.belief.update',
      sid: 'test-session',
      assertion: {
        id: 'A1',
        type: 'fact',
        content: 'Some evidence',
        consistent_with: ['H1'],
        inconsistent_with: ['H2'],
      },
    };

    const result = warmhubPlugin.renderEntry!(entry, baseCtx);
    expect(result).not.toBeNull();
    expect(result?.html).toContain('belief update');
    expect(result?.html).toContain('A1');
    expect(result?.html).toContain('Some evidence');
    expect(result?.html).toContain('+H1');
    expect(result?.html).toContain('-H2');
    expect(result?.cssClasses).toContain('warmhub-belief-update');
  });

  it('renders warmhub.react.step entries', () => {
    const entry: AEFEntry & { step: number; action: string; thought?: string } = {
      v: 1,
      id: 'rs-1',
      ts: 1704067200000,
      type: 'warmhub.react.step',
      sid: 'test-session',
      step: 3,
      thought: 'I should search for more information',
      action: 'Search',
      action_arg: 'query here',
      observation: 'Search results...',
      latency_ms: 150,
    };

    const result = warmhubPlugin.renderEntry!(entry, baseCtx);
    expect(result).not.toBeNull();
    expect(result?.html).toContain('step 3');
    expect(result?.html).toContain('Search');
    expect(result?.html).toContain('I should search for more information');
    expect(result?.html).toContain('query here');
    expect(result?.html).toContain('150ms');
    expect(result?.cssClasses).toContain('warmhub-react-step');
  });

  it('renders warmhub.react.episode entries', () => {
    const entry: AEFEntry & {
      question_id: string;
      question: string;
      gold_answer: string;
      predicted_answer: string;
      status: string;
      metrics: unknown;
      belief_metrics?: unknown;
    } = {
      v: 1,
      id: 're-1',
      ts: 1704067200000,
      type: 'warmhub.react.episode',
      sid: 'test-session',
      question_id: 'Q123',
      question: 'What is the capital of France?',
      gold_answer: 'Paris',
      predicted_answer: 'Paris',
      status: 'success',
      metrics: {
        em: 1,
        f1: 1,
        tool_calls: 3,
        total_latency_ms: 5000,
        total_tokens: 1500,
      },
      belief_metrics: {
        hypothesis_reversals: 1,
        final_confidence: 0.85,
        uncertainty_reduction: 0.7,
        finish_gate_respected: true,
      },
    };

    const result = warmhubPlugin.renderEntry!(entry, baseCtx);
    expect(result).not.toBeNull();
    expect(result?.html).toContain('success');
    expect(result?.html).toContain('100%'); // EM
    expect(result?.html).toContain('What is the capital of France?');
    expect(result?.html).toContain('Paris');
    expect(result?.html).toContain('3'); // tool calls
    expect(result?.html).toContain('85%'); // confidence
    expect(result?.cssClasses).toContain('warmhub-react-episode');
  });

  it('returns null for unknown entry types', () => {
    const entry: AEFEntry = {
      v: 1,
      id: 'unknown-1',
      ts: 1704067200000,
      type: 'warmhub.unknown.type',
      sid: 'test-session',
    };

    const result = warmhubPlugin.renderEntry!(entry, baseCtx);
    expect(result).toBeNull();
  });
});

describe('warmhubPlugin aggregations', () => {
  it('has beliefTrajectory aggregation', () => {
    const beliefTrajectory = warmhubPlugin.aggregations?.find((a) => a.name === 'beliefTrajectory');
    expect(beliefTrajectory).toBeDefined();
    expect(beliefTrajectory?.types).toContain('warmhub.belief.query');
    expect(beliefTrajectory?.position).toBe('header');
  });

  it('has toolWaterfall aggregation', () => {
    const toolWaterfall = warmhubPlugin.aggregations?.find((a) => a.name === 'toolWaterfall');
    expect(toolWaterfall).toBeDefined();
    expect(toolWaterfall?.types).toContain('warmhub.react.step');
  });

  it('beliefTrajectory renders sparklines', () => {
    const beliefTrajectory = warmhubPlugin.aggregations?.find((a) => a.name === 'beliefTrajectory');
    const entries = [
      {
        v: 1,
        id: 'bq-1',
        ts: 1000,
        type: 'warmhub.belief.query',
        sid: 'test',
        query: 'Q1',
        snapshot: {
          hypotheses: [{ id: 'H1', desc: 'Test', b: 0.5, d: 0.2, u: 0.3 }],
          assertions: 1,
          finish_ready: false,
        },
      },
      {
        v: 1,
        id: 'bq-2',
        ts: 2000,
        type: 'warmhub.belief.query',
        sid: 'test',
        query: 'Q2',
        snapshot: {
          hypotheses: [{ id: 'H1', desc: 'Test', b: 0.8, d: 0.1, u: 0.1 }],
          assertions: 2,
          finish_ready: true,
        },
      },
    ] as AEFEntry[];

    const html = beliefTrajectory?.render(entries, baseCtx);
    expect(html).toContain('Belief Trajectory');
    expect(html).toContain('H1');
    expect(html).toContain('svg'); // sparkline
  });

  it('beliefTrajectory handles empty data', () => {
    const beliefTrajectory = warmhubPlugin.aggregations?.find((a) => a.name === 'beliefTrajectory');
    const html = beliefTrajectory?.render([], baseCtx);
    expect(html).toContain('No belief queries found');
  });

  it('toolWaterfall renders timeline', () => {
    const toolWaterfall = warmhubPlugin.aggregations?.find((a) => a.name === 'toolWaterfall');
    const entries = [
      {
        v: 1,
        id: 'rs-1',
        ts: 1000,
        type: 'warmhub.react.step',
        sid: 'test',
        step: 1,
        action: 'Search',
        latency_ms: 100,
      },
      {
        v: 1,
        id: 'rs-2',
        ts: 1100,
        type: 'warmhub.react.step',
        sid: 'test',
        step: 2,
        action: 'Lookup',
        latency_ms: 200,
      },
    ] as AEFEntry[];

    const html = toolWaterfall?.render(entries, baseCtx);
    expect(html).toContain('Execution Timeline');
    expect(html).toContain('svg'); // compact waterfall
    expect(html).toContain('2 steps');
  });

  it('toolWaterfall returns empty for no steps', () => {
    const toolWaterfall = warmhubPlugin.aggregations?.find((a) => a.name === 'toolWaterfall');
    const html = toolWaterfall?.render([], baseCtx);
    expect(html).toBe('');
  });
});
